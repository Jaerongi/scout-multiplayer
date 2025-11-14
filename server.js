// ================================
// SCOUT MULTIPLAYER – SERVER FINAL
// ================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("🚀 SCOUT SERVER RUNNING:", PORT);
});

// ================================
// 방 정보 저장
// ================================
const rooms = {};

// ================================
// 44장 커스텀 카드 덱
// ================================
const SCOUT_DECK = [
  {top:1,bottom:7},{top:1,bottom:9},{top:1,bottom:5},{top:1,bottom:4},
  {top:2,bottom:6},{top:2,bottom:8},{top:2,bottom:9},{top:2,bottom:5},
  {top:3,bottom:7},{top:3,bottom:6},{top:3,bottom:1},{top:3,bottom:10},
  {top:4,bottom:8},{top:4,bottom:2},{top:4,bottom:10},{top:4,bottom:7},
  {top:5,bottom:9},{top:5,bottom:3},{top:5,bottom:8},{top:5,bottom:1},
  {top:6,bottom:4},{top:6,bottom:1},{top:6,bottom:10},{top:6,bottom:3},
  {top:7,bottom:2},{top:7,bottom:9},{top:7,bottom:5},{top:7,bottom:4},
  {top:8,bottom:3},{top:8,bottom:6},{top:8,bottom:2},{top:8,bottom:10},
  {top:9,bottom:5},{top:9,bottom:7},{top:9,bottom:4},{top:9,bottom:1},
  {top:10,bottom:8},{top:10,bottom:6},{top:10,bottom:3},{top:10,bottom:2},
  {top:1,bottom:3},{top:2,bottom:4},{top:5,bottom:7},{top:8,bottom:9},
];

function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function dealForMultiplayer(n) {
  let deck = shuffle(SCOUT_DECK);
  const hands = [];

  for (let i = 0; i < n; i++) {
    hands.push(deck.slice(i * 11, i * 11 + 11));
  }

  deck = deck.slice(n * 11);
  return { hands, deck };
}

// ================================
// SOCKET.IO LOGIC
// ================================
io.on("connection", (socket) => {
  console.log("🟢 CONNECT:", socket.id);

  // ======================================
  // 방 입장
  // ======================================
  socket.on("joinRoom", ({ roomId, nickname }) => {
    if (!roomId || !nickname) return;

    socket.join(roomId);

    // 방이 없으면 생성
    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        round: 1,
        players: {},
        tableCards: [],
        turnOrder: [],
        currentTurnIndex: 0,
      };
    }

    const room = rooms[roomId];
    const isHost = Object.keys(room.players).length === 0;

    // 플레이어 추가
    room.players[socket.id] = {
      uid: socket.id,
      nickname,
      isHost,
      ready: false,
      hand: [],
      handCount: 0,
      coins: 0,
      score: 0,
    };

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // ======================================
  // Ready Toggle
  // ======================================
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const p = room.players[socket.id];
    if (!p) return;

    p.ready = !p.ready;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // ======================================
  // 게임 시작
  // ======================================
  socket.on("forceStartGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    io.to(roomId).emit("goGame");

    setTimeout(() => startRound(room), 500);
  });

  // ======================================
  // SHOW
  // ======================================
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const p = room.players[socket.id];
    if (!p) return;

    room.tableCards = cards;

    p.hand = p.hand.filter(c =>
      !cards.some(cs => cs.top === c.top && cs.bottom === c.bottom)
    );
    p.handCount = p.hand.length;

    io.to(roomId).emit("tableUpdate", room.tableCards);
    updateHandCounts(room);
    nextTurn(room);
  });

  // ======================================
  // SCOUT
  // ======================================
  socket.on("scout", ({ roomId, chosenValue }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.tableCards.length !== 1) return;

    const t = room.tableCards[0];
    const card =
      chosenValue === "bottom"
        ? { top: t.bottom, bottom: t.top }
        : { top: t.top, bottom: t.bottom };

    const p = room.players[socket.id];
    p.hand.push(card);
    p.handCount++;

    room.tableCards = [];
    io.to(roomId).emit("tableUpdate", []);

    updateHandCounts(room);
    nextTurn(room);
  });

  // ======================================
  // PASS
  // ======================================
  socket.on("pass", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    nextTurn(room);
  });

  // ======================================
  // Disconnect
  // ======================================
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

// ================================
// ROUND START
// ================================
function startRound(room) {
  const uids = Object.keys(room.players);
  const n = uids.length;

  const { hands, deck } = dealForMultiplayer(n);

  room.tableCards = [];
  room.turnOrder = uids;
  room.currentTurnIndex = 0;

  // 패 배분
  for (let i = 0; i < n; i++) {
    const uid = uids[i];
    room.players[uid].hand = hands[i];
    room.players[uid].handCount = hands[i].length;
    room.players[uid].coins = 0;

    io.to(uid).emit("yourHand", hands[i]);
  }

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[0],
  });

  updateHandCounts(room);
  io.to(room.roomId).emit("turnChange", room.turnOrder[0]);
}

// ================================
// 턴 변경
// ================================
function nextTurn(room) {
  room.currentTurnIndex =
    (room.currentTurnIndex + 1) % room.turnOrder.length;

  io.to(room.roomId).emit(
    "turnChange",
    room.turnOrder[room.currentTurnIndex]
  );
}

// ================================
// 손패 갱신
// ================================
function updateHandCounts(room) {
  const counts = {};
  for (let uid in room.players) {
    counts[uid] = room.players[uid].handCount;
  }
  io.to(room.roomId).emit("handCountUpdate", counts);
}
