// =============================
// SCOUT MULTIPLAYER - SERVER (Stable Version)
// =============================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// 정적 파일 위치
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("SERVER START :", PORT);
});

// -----------------------------
// 방 데이터 구조
// -----------------------------
const rooms = {};

// -----------------------------
// 카드 44장 생성
// -----------------------------
function createDeck() {
  const deck = [];
  for (let t = 1; t <= 10; t++) {
    for (let b = 1; b <= 10; b++) {
      if (t !== b) deck.push({ top: t, bottom: b });
    }
  }
  return deck;
}

// -----------------------------
// 셔플
// -----------------------------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// -----------------------------
// 카드 분배
// -----------------------------
function dealForMultiplayer(count) {
  const deck = shuffle(createDeck());
  const handSize = Math.floor(deck.length / count);
  const hands = [];

  for (let i = 0; i < count; i++) {
    hands.push(deck.splice(0, handSize));
  }
  return { hands, deck };
}

// =========================================================
// SOCKET.IO
// =========================================================
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  // ---------------------------
  // 방 입장
  // ---------------------------
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
    const isHost = Object.keys(room.players).length === 0;

    room.players[socket.id] = {
      uid: socket.id,
      nickname,
      isHost,
      ready: false,
      hand: [],
      handCount: 0,
      coins: 0,
      score: 0
    };

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // ---------------------------
  // READY
  // ---------------------------
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[socket.id].ready = !room.players[socket.id].ready;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // ---------------------------
  // 게임 시작 (방장만 가능)
  // ---------------------------
  socket.on("forceStartGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    io.to(roomId).emit("goGame");

    setTimeout(() => {
      startRound(room);
    }, 300);
  });

  // ---------------------------
  // SHOW
  // ---------------------------
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;
    const uid = socket.id;

    room.tableCards = cards;

    room.players[uid].hand = room.players[uid].hand.filter(c =>
      !cards.some(cs => cs.top === c.top && cs.bottom === c.bottom)
    );
    room.players[uid].handCount = room.players[uid].hand.length;

    io.to(roomId).emit("tableUpdate", room.tableCards);
    updateHandCounts(room);
    nextTurn(room);
  });

  // ---------------------------
  // SCOUT
  // ---------------------------
  socket.on("scout", ({ roomId, chosenValue }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.tableCards.length !== 1) return;

    const base = room.tableCards[0];
    const card = (chosenValue === "bottom")
      ? { top: base.bottom, bottom: base.top }
      : { top: base.top, bottom: base.bottom };

    room.players[socket.id].hand.push(card);
    room.players[socket.id].handCount++;

    room.tableCards = [];
    io.to(roomId).emit("tableUpdate", room.tableCards);

    updateHandCounts(room);
    nextTurn(room);
  });

  // ---------------------------
  // PASS
  // ---------------------------
  socket.on("pass", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    nextTurn(room);
  });

  // ---------------------------
  // 연결 종료
  // ---------------------------
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

// =========================================================
// ROUND START
// =========================================================
function startRound(room) {
  const uids = Object.keys(room.players);
  const pCount = uids.length;

  const { hands, deck } = dealForMultiplayer(pCount);

  room.tableCards = [];

  for (let i = 0; i < pCount; i++) {
    const uid = uids[i];
    room.players[uid].hand = hands[i];
    room.players[uid].handCount = hands[i].length;
    room.players[uid].coins = 0;
  }

  room.turnOrder = uids;
  room.currentTurnIndex = 0;

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[0]
  });

  for (let i = 0; i < pCount; i++) {
    const uid = uids[i];
    io.to(uid).emit("yourHand", room.players[uid].hand);
  }

  updateHandCounts(room);
}

// =========================================================
// TURN
// =========================================================
function nextTurn(room) {
  room.currentTurnIndex =
    (room.currentTurnIndex + 1) % room.turnOrder.length;

  const uid = room.turnOrder[room.currentTurnIndex];
  io.to(room.roomId).emit("turnChange", uid);
}

// =========================================================
// HAND COUNT UPDATE
// =========================================================
function updateHandCounts(room) {
  const data = {};
  for (const uid in room.players) {
    data[uid] = room.players[uid].handCount;
  }
  io.to(room.roomId).emit("handCountUpdate", data);
}
