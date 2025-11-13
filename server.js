// =============================
// SCOUT MULTIPLAYER v3 – SERVER
// shared.js와 완전 통합된 최신 안정판
// =============================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { 
  SCOUT_DECK,
  shuffle,
  dealForMultiplayer,
  applyRoundScores
} from "./public/shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("SCOUT SERVER START:", PORT);
});

// --------------------------------------
// 방 목록
// --------------------------------------
const rooms = {};

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

  // ------------------------------
  // READY
  // ------------------------------
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[socket.id].ready = !room.players[socket.id].ready;
    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // ------------------------------
  // 게임 시작
  // ------------------------------
  socket.on("forceStartGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    io.to(roomId).emit("goGame");

    // game.html 로딩 시간을 고려해 지연
    setTimeout(() => startRound(room), 600);
  });

  // ------------------------------
  // SHOW
  // ------------------------------
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;
    const uid = socket.id;

    room.tableCards = cards;

    room.players[uid].hand = room.players[uid].hand.filter(c =>
      !cards.some(cc => cc.top === c.top && cc.bottom === c.bottom)
    );
    room.players[uid].handCount = room.players[uid].hand.length;

    io.to(roomId).emit("tableUpdate", room.tableCards);
    updateHandCounts(room);
    nextTurn(room);
  });

  // ------------------------------
  // SCOUT
  // ------------------------------
  socket.on("scout", ({ roomId, chosenValue }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.tableCards.length !== 1) return;

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

  // ------------------------------
  // PASS
  // ------------------------------
  socket.on("pass", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    nextTurn(room);
  });

  // ------------------------------
  // 연결 종료
  // ------------------------------
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

// ======================================
// ROUND START
// ======================================
function startRound(room) {
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

  // 자기 패 전송
  for (const uid of uids) {
    io.to(uid).emit("yourHand", room.players[uid].hand);
  }

  updateHandCounts(room);
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

// ======================================
function updateHandCounts(room) {
  const data = {};
  for (let uid in room.players) {
    data[uid] = room.players[uid].handCount;
  }
  io.to(room.roomId).emit("handCountUpdate", data);
}
