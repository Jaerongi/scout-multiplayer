// =============================
// SCOUT MULTIPLAYER FINAL SERVER
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
  console.log("SCOUT SERVER START:", PORT);
});

// --------------------------------------
// 방 정보 저장
// --------------------------------------
const rooms = {};

// --------------------------------------
// 카드 44장 생성
// --------------------------------------
function createDeck() {
  const deck = [];
  for (let t = 1; t <= 10; t++) {
    for (let b = 1; b <= 10; b++) {
      if (t !== b) deck.push({ top: t, bottom: b });
    }
  }
  return deck;
}

// --------------------------------------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 배분
function dealForMultiplayer(playerCount) {
  let deck = shuffle(createDeck());
  const each = Math.floor(deck.length / playerCount);
  const hands = [];

  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.splice(0, each));
  }
  return { hands, deck };
}

// ======================================
// SOCKET.IO
// ======================================
io.on("connection", (socket) => {
  console.log("CONNECT:", socket.id);

  // ------------------------------
  // 방 입장
  // ------------------------------
  socket.on("joinRoom", ({ roomId, nickname }) => {
    if (!roomId || !nickname) return;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        round: 1,
        players: {},
        tableCards: [],
        turnOrder: [],
        currentTurnIndex: 0
      };
    }

    const room = rooms[roomId];

    room.players[socket.id] = {
      uid: socket.id,
      nickname,
      hand: [],
      score: 0
    };

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // ------------------------------
  // flip 확정 반영
  // ------------------------------
  socket.on("confirmFlip", ({ roomId, flippedOrder }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (!room.players[socket.id]) return;

    room.players[socket.id].hand = flippedOrder;
  });

  // ------------------------------
  socket.on("forceStartGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    io.to(roomId).emit("goGame");
    setTimeout(() => startRound(room), 400);
  });

  // ------------------------------
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;

    // 점수 추가
    const taken = room.tableCards.length;
    room.players[uid].score += taken;

    // 테이블 갱신
    room.tableCards = cards;

    // 내 패 삭제
    room.players[uid].hand = room.players[uid].hand.filter(c =>
      !cards.some(s => s.top === c.top && s.bottom === c.bottom)
    );

    io.to(roomId).emit("tableUpdate", room.tableCards);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

  // ------------------------------
  socket.on("scout", ({ roomId, side }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;

    if (room.tableCards.length === 0) return;

    let card;
    if (side === "left") card = room.tableCards.shift();
    else card = room.tableCards.pop();

    room.players[uid].hand.push(card);

    io.to(roomId).emit("tableUpdate", room.tableCards);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

  // ------------------------------
  socket.on("disconnect", () => {
    for (const id in rooms) {
      const room = rooms[id];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(id).emit("playerListUpdate", room.players);
      }
    }
  });
});

// ======================================
// ROUND START — ★ 수정 핵심
// ======================================
function startRound(room) {
  const uids = Object.keys(room.players);

  // 🔥 입장 순서대로 턴 유지 (정렬 금지!)
  room.turnOrder = [...uids];
  room.currentTurnIndex = 0;

  const { hands, deck } = dealForMultiplayer(uids.length);
  room.deck = deck;
  room.tableCards = [];

  for (let i = 0; i < uids.length; i++) {
    const uid = uids[i];
    room.players[uid].hand = hands[i];
  }

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[0],
    turnOrder: room.turnOrder        // 👈 클라이언트로 전달
  });

  // 패 전달
  for (const uid of room.turnOrder) {
    io.to(uid).emit("yourHand", room.players[uid].hand);
  }

  io.to(room.roomId).emit("turnChange", room.turnOrder[0]);
}

// ======================================
function nextTurn(room) {
  room.currentTurnIndex =
    (room.currentTurnIndex + 1) % room.turnOrder.length;

  io.to(room.roomId).emit(
    "turnChange",
    room.turnOrder[room.currentTurnIndex]
  );
}
