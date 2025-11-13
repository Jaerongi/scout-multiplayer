// =============================
// SCOUT MULTIPLAYER v4 (SPA용)
// =============================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

// shared.js (SCOUT 엔진)
import {
  SCOUT_DECK,
  shuffle,
  dealForMultiplayer,
  applyRoundScores
} from "./public/shared.js";

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

// ==========================================
// ROOM STRUCTURE
// ==========================================
/*
rooms = {
  "ABC123": {
     roomId: "ABC123",
     round: 1,
     players: { uid: {...} },
     tableCards: [],
     turnOrder: [],
     currentTurnIndex: 0
  }
}
*/
const rooms = {};

// ==========================================
// SOCKET.IO
// ==========================================
io.on("connection", (socket) => {
  console.log("🔌 CONNECT:", socket.id);

  // ------------------------------------
  // 1) Room Join
  // ------------------------------------
  socket.on("joinRoom", ({ roomId, nickname }) => {
    if (!roomId || !nickname) return;

    console.log(`📌 JOIN ROOM: ${roomId} as ${nickname}`);

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

  // ------------------------------------
  // 2) READY
  // ------------------------------------
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[socket.id].ready = !room.players[socket.id].ready;
    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // ------------------------------------
  // 3) GAME START
  // ------------------------------------
  socket.on("forceStartGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    console.log("🎮 GAME START:", roomId);

    io.to(roomId).emit("goGame");

    // SPA 구조: 소켓 유지되므로 바로 라운드 시작 가능
    setTimeout(() => startRound(room), 300);
  });

  // ------------------------------------
  // 4) SHOW
  // ------------------------------------
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;

    // 테이블 갱신
    room.tableCards = cards;

    // 손패 제거
    room.players[uid].hand = room.players[uid].hand.filter(c =>
      !cards.some(cs => cs.top === c.top && cs.bottom === c.bottom)
    );
    room.players[uid].handCount = room.players[uid].hand.length;

    io.to(roomId).emit("tableUpdate", room.tableCards);
    updateHandCounts(room);

    nextTurn(room);
  });

  // ------------------------------------
  // 5) SCOUT
  // ------------------------------------
  socket.on("scout", ({ roomId, chosenValue }) => {
    const room = rooms[roomId];
    if (!room || room.tableCards.length !== 1) return;

    const base = room.tableCards[0];

    const card =
      chosenValue === "bottom"
        ? { top: base.bottom, bottom: base.top }
        : { top: base.top, bottom: base.bottom };

    room.players[socket.id].hand.push(card);
    room.players[socket.id].handCount++;
    room.players[socket.id].coins++;

    room.tableCards = [];
    io.to(roomId).emit("tableUpdate", room.tableCards);

    updateHandCounts(room);
    nextTurn(room);
  });

  // ------------------------------------
  // 6) PASS
  // ------------------------------------
  socket.on("pass", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    nextTurn(room);
  });

  // ------------------------------------
  // 7) DISCONNECT
  // ------------------------------------
  socket.on("disconnect", () => {
    console.log("⛔ DISCONNECT:", socket.id);

    for (const id in rooms) {
      const room = rooms[id];

      if (!room.players[socket.id]) continue;

      delete room.players[socket.id];
      io.to(id).emit("playerListUpdate", room.players);
    }
  });
});

// =======================================================
// ROUND START LOGIC
// =======================================================
function startRound(room) {
  console.log(`🔥 START ROUND: ${room.roomId}`);

  const uids = Object.keys(room.players);
  const n = uids.length;

  const { hands, deck } = dealForMultiplayer(n);

  room.tableCards = [];

  for (let i = 0; i < n; i++) {
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

  // 자기 손패 개별 전송
  uids.forEach(uid => {
    io.to(uid).emit("yourHand", room.players[uid].hand);
  });

  updateHandCounts(room);

  io.to(room.roomId).emit("turnChange", room.turnOrder[0]);
}

// =======================================================
// TURN CHANGE
// =======================================================
function nextTurn(room) {
  room.currentTurnIndex =
    (room.currentTurnIndex + 1) % room.turnOrder.length;

  const next = room.turnOrder[room.currentTurnIndex];

  io.to(room.roomId).emit("turnChange", next);
}

// =======================================================
// UPDATE HAND COUNTS
// =======================================================
function updateHandCounts(room) {
  const data = {};
  for (let uid in room.players) {
    data[uid] = room.players[uid].handCount;
  }
  io.to(room.roomId).emit("handCountUpdate", data);
}
