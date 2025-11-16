// =============================
// SCOUT MULTIPLAYER – FINAL server.js
// =============================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("SERVER START", PORT);
});

const rooms = {};

// ------------------------------------
// 45장 기본 덱 생성
// ------------------------------------
function createDeck() {
  const deck = [];
  for (let t = 1; t <= 10; t++) {
    for (let b = 1; b <= 10; b++) {
      if (t !== b) deck.push({ top: t, bottom: b });
    }
  }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ------------------------------------
// 인원수 규칙 기반 카드 분배
// ------------------------------------
function dealForPlayers(playerCount) {
  let deck = createDeck(); // 45장
  deck = shuffle(deck);

  // 🎯 1인 플레이 불가
  if (playerCount === 1) return null;

  // 🎯 3인 → 10 포함된 카드 전체 제거(9장)
  if (playerCount === 3) {
    deck = deck.filter(c => c.top !== 10 && c.bottom !== 10);
  }

  // 🎯 2인 혹은 4인 → 9/10 또는 10/9 카드 1장 제거
  if (playerCount === 2 || playerCount === 4) {
    const idx = deck.findIndex(c =>
      (c.top === 9 && c.bottom === 10) ||
      (c.top === 10 && c.bottom === 9)
    );
    if (idx !== -1) deck.splice(idx, 1); // 1장 제거 → 총 44장
  }

  // 🎯 섞기
  deck = shuffle(deck);

  // 🎯 기본 분배 수
  let handSize = Math.floor(deck.length / playerCount);

  // 3인은 고정 12장
  if (playerCount === 3) handSize = 12;

  const hands = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.splice(0, handSize));
  }

  return hands;
}

// ------------------------------------
// CONNECTION
// ------------------------------------
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  socket.on("joinRoom", ({ roomId, nickname }) => {
    if (!roomId || !nickname) return;

    socket.join(roomId);

    // 방 생성
    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        players: {},
        turnOrder: [],
        currentTurnIndex: 0,
        tableCards: [],
        round: 1,
        host: null
      };
    }

    const room = rooms[roomId];
    const isFirst = Object.keys(room.players).length === 0;

    // 플레이어 등록
    room.players[socket.id] = {
      uid: socket.id,
      nickname,
      isHost: isFirst,
      ready: false,
      hand: [],
      score: 0
    };

    if (isFirst) room.host = socket.id;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // READY
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.players[socket.id].isHost) return;

    room.players[socket.id].ready = !room.players[socket.id].ready;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // START
  socket.on("startGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.host !== socket.id) return;

    const allReady = Object.values(room.players)
      .filter((p) => !p.isHost)
      .every((p) => p.ready);

    if (!allReady) {
      io.to(socket.id).emit("errorMessage", "모두 준비 완료가 아닙니다!");
      return;
    }

    startRound(room);
    io.to(roomId).emit("goGamePage");
  });

  // 확정된 flip 저장
  socket.on("confirmFlip", ({ roomId, flipped }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[socket.id].hand = flipped;
  });

  // ------------------------------------
  // SHOW (점수 + 패삭제 + 패전송)
  // ------------------------------------
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;
    const player = room.players[uid];

    // ⭐ 기존 테이블 카드 수 만큼 점수 증가
    const gained = room.tableCards.length;
    player.score += gained;

    // ⭐ 패 삭제
    player.hand = player.hand.filter(
      h => !cards.some(c => c.top === h.top && c.bottom === h.bottom)
    );
    player.handCount = player.hand.length;

    // 테이블 업데이트
    room.tableCards = cards;

    io.to(roomId).emit("tableUpdate", cards);
    io.to(roomId).emit("playerListUpdate", room.players);

    // ⭐ 모든 플레이어에게 자신의 hand 재발송
    Object.values(room.players).forEach(p => {
      io.to(p.uid).emit("yourHand", p.hand);
    });

    nextTurn(room);
  });

  // ------------------------------------
  // SCOUT
  // ------------------------------------
  socket.on("scout", ({ roomId, side }) => {
    const room = rooms[roomId];
    if (!room) return;

    const take =
      side === "left" ? room.tableCards.shift() : room.tableCards.pop();

    if (!take) return;

    room.players[socket.id].hand.push(take);
    room.players[socket.id].handCount++;

    io.to(roomId).emit("tableUpdate", room.tableCards);
    io.to(roomId).emit("playerListUpdate", room.players);

    // 패 갱신 보내기
    io.to(socket.id).emit("yourHand", room.players[socket.id].hand);

    nextTurn(room);
  });

  // disconnect
  socket.on("disconnect", () => {
    for (const r in rooms) {
      const room = rooms[r];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(r).emit("playerListUpdate", room.players);
      }
    }
  });
});

// ------------------------------------
// ROUND START
// ------------------------------------
function startRound(room) {
  const uids = Object.keys(room.players);

  const hands = dealForPlayers(uids.length);
  if (!hands) return;

  for (let i = 0; i < uids.length; i++) {
    room.players[uids[i]].hand = hands[i];
    room.players[uids[i]].handCount = hands[i].length;
  }

  room.turnOrder = uids; // 입장 순서 그대로
  room.currentTurnIndex = 0;
  room.tableCards = [];

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[0]
  });

  uids.forEach(uid => {
    io.to(uid).emit("yourHand", room.players[uid].hand);
  });

  io.to(room.roomId).emit("turnChange", room.turnOrder[0]);
}

// ------------------------------------
function nextTurn(room) {
  room.currentTurnIndex =
    (room.currentTurnIndex + 1) % room.turnOrder.length;

  const next = room.turnOrder[room.currentTurnIndex];
  io.to(room.roomId).emit("turnChange", next);
}
