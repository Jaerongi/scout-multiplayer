// =============================
// SCOUT MULTIPLAYER – server.js
// =============================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { getComboType, isStrongerCombo } from "./shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("SERVER START", PORT);
});

const rooms = {};

// =========================================
// 공식 SCOUT 45장 덱 생성 (A안 기반)
// =========================================
function createDeck() {
  const deck = [];
  for (let t = 1; t <= 9; t++) {
    for (let b = t + 1; b <= 10; b++) {
      deck.push({ top: t, bottom: b });
    }
  }
  return deck; // 총 45장
}

// =========================================
// 셔플
// =========================================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// =========================================
// 인원수에 따른 분배 + 방향 랜덤
// =========================================
function deal(playerCount) {
  let deck = shuffle(createDeck());

  // 1) 3인 → 숫자 10 포함한 카드 모두 제거 (9장)
  if (playerCount === 3) {
    deck = deck.filter(c => c.top !== 10 && c.bottom !== 10);
  }

  // 2) 2인 or 4인 → 총 44장이 되도록 1장 제거
  if (playerCount === 2 || playerCount === 4) {
    while (deck.length > 44) deck.pop();
  }

  // 1인 플레이 불가
  if (playerCount < 2) return [];

  // 정확히 나눠떨어지도록 deck 줄이기
  const remove = deck.length % playerCount;
  for (let i = 0; i < remove; i++) deck.pop();

  const size = deck.length / playerCount;
  const hands = [];

  for (let i = 0; i < playerCount; i++) {
    let hand = deck.splice(0, size);

    // top/bottom 뒤집기 랜덤
    hand = hand.map(c => {
      if (Math.random() < 0.5) return c;
      return { top: c.bottom, bottom: c.top };
    });

    hands.push(hand);
  }

  return hands;
}

// =========================================
// CONNECTION
// =========================================
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  // --------------------------
  // JOIN ROOM
  // --------------------------
  socket.on("joinRoom", ({ roomId, nickname }) => {
    if (!roomId || !nickname) return;

    socket.join(roomId);

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

  // --------------------------
  // READY
  // --------------------------
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.players[socket.id].isHost) return;

    room.players[socket.id].ready = !room.players[socket.id].ready;
    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // --------------------------
  // START GAME
  // --------------------------
  socket.on("startGame", ({ roomId }) => {
  const room = rooms[roomId];
  if (!room) return;

  // 방장 체크
  if (room.host !== socket.id) return;

  // 방장 제외 모두 준비완료인지 확인
  const allReady = Object.values(room.players)
    .filter((p) => !p.isHost)
    .every((p) => p.ready === true);

  if (!allReady) {
    io.to(socket.id).emit("errorMessage", "모두 준비 완료가 아닙니다!");
    return;
  }

  // 게임 라운드 시작
  startRound(room);

  // ★ 이 이벤트가 클라이언트의 게임 화면을 열어줌
  io.to(roomId).emit("goGamePage");
});


  // --------------------------
  // CONFIRM FLIP
  // --------------------------
  socket.on("confirmFlip", ({ roomId, flipped }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[socket.id].hand = flipped;
  });

  // --------------------------
  // SHOW
  // --------------------------
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;
    const player = room.players[uid];

    // 기존 테이블 카드 수 만큼 점수 +
    player.score += room.tableCards.length;

    // 내 패에서 제거
    player.hand = player.hand.filter(
      h => !cards.some(c => c.top === h.top && c.bottom === h.bottom)
    );

    // 테이블 갱신
    room.tableCards = cards;

    // 전송
    io.to(roomId).emit("tableUpdate", cards);
    io.to(roomId).emit("playerListUpdate", room.players);

    // ★ 내 패 다시 전송
    io.to(uid).emit("yourHand", player.hand);

    nextTurn(room);
  });

  // --------------------------
  // SCOUT
  // --------------------------
  socket.on("scout", ({ roomId, side, flipped, insertIndex }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;
    const player = room.players[uid];

    let take = null;

    if (room.tableCards.length === 1) {
      take = room.tableCards.pop();
    } else if (room.tableCards.length >= 2) {
      take = side === "left"
        ? room.tableCards.shift()
        : room.tableCards.pop();
    }

    if (!take) return;

    // 뒤집기
    if (flipped) {
      take = { top: take.bottom, bottom: take.top };
    }

    // 삽입 위치 보정
    if (insertIndex < 0 || insertIndex > player.hand.length) {
      insertIndex = player.hand.length;
    }

    player.hand.splice(insertIndex, 0, take);

    io.to(roomId).emit("tableUpdate", room.tableCards);
    io.to(roomId).emit("playerListUpdate", room.players);

    // ★ 내 패 다시 전송
    io.to(uid).emit("yourHand", player.hand);

    nextTurn(room);
  });

  // --------------------------
  // DISCONNECT
  // --------------------------
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

// =========================================
// ROUND START
// =========================================
function startRound(room) {
  const uids = Object.keys(room.players);
  const hands = deal(uids.length);

  uids.forEach((uid, i) => {
    room.players[uid].hand = hands[i];
  });

  room.turnOrder = uids;
  room.currentTurnIndex = 0;
  room.tableCards = [];

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[0]
  });

  // → 각자에게 핸드 보내기
  uids.forEach(uid => {
    io.to(uid).emit("yourHand", room.players[uid].hand);
  });

  io.to(room.roomId).emit("turnChange", room.turnOrder[0]);
}

function nextTurn(room) {
  room.currentTurnIndex =
    (room.currentTurnIndex + 1) % room.turnOrder.length;

  io.to(room.roomId).emit(
    "turnChange",
    room.turnOrder[room.currentTurnIndex]
  );
}



