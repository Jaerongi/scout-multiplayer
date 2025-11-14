// ==============================
// SCOUT MULTIPLAYER – SERVER.js
// (SPA + Socket.io 안정 버전)
// ==============================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

// --------------------------------------
// 기본 설정
// --------------------------------------
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("🚀 SCOUT SERVER RUNNING ON PORT:", PORT);
});

// --------------------------------------
// 방 구조
// --------------------------------------
const rooms = {}; // roomId → roomData

// --------------------------------------
// 카드 덱 생성 (SCOUT 공식 44장)
// --------------------------------------
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

// --------------------------------------
// 셔플
// --------------------------------------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --------------------------------------
// 패 배분 (44장을 인원수로 분할)
// --------------------------------------
function dealCards(playerCount) {
  let deck = shuffle([...SCOUT_DECK]);
  const handSize = Math.floor(deck.length / playerCount);

  const hands = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.splice(0, handSize));
  }
  return { hands, deck };
}

// =================================================================
// SOCKET.IO
// =================================================================
io.on("connection", (socket) => {
  console.log("🟢 CONNECT:", socket.id);

  // ------------------------------
  // 방 입장
  // ------------------------------
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

  // ------------------------------
  // READY 토글
  // ------------------------------
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[socket.id].ready =
      !room.players[socket.id].ready;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // ------------------------------
  // 게임 강제 시작 (방장)
  // ------------------------------
  socket.on("forceStartGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    // 게임 페이지 이동
    io.to(roomId).emit("goGame");

    setTimeout(() => {
      startRound(room);
    }, 400);
  });

  // ------------------------------
  // SHOW
  // ------------------------------
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.tableCards = cards;

    room.players[socket.id].hand =
      room.players[socket.id].hand.filter(
        c => !cards.some(cc => cc.top === c.top && cc.bottom === c.bottom)
      );
    room.players[socket.id].handCount =
      room.players[socket.id].hand.length;

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

    const t = room.tableCards[0];
    const taken = chosenValue === "bottom"
      ? { top: t.bottom, bottom: t.top }
      : { top: t.top, bottom: t.bottom };

    room.players[socket.id].hand.push(taken);
    room.players[socket.id].handCount++;

    room.tableCards = [];
    io.to(roomId).emit("tableUpdate", []);

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
    for (const id in rooms) {
      const room = rooms[id];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(id).emit("playerListUpdate", room.players);
      }
    }
    console.log("🔴 DISCONNECT:", socket.id);
  });
});

// =================================================================
// 라운드 시작
// =================================================================
function startRound(room) {
  const uids = Object.keys(room.players);
  const n = uids.length;

  const { hands } = dealCards(n);

  room.tableCards = [];
  room.turnOrder = uids;
  room.currentTurnIndex = 0;

  for (let i = 0; i < n; i++) {
    const uid = uids[i];
    room.players[uid].hand = hands[i];
    room.players[uid].handCount = hands[i].length;
    room.players[uid].coins = 0;
  }

  // 라운드 시작 브로드캐스트
  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[0],
  });

  // 각 플레이어에게 개별 hand 전달
  for (const uid of uids) {
    io.to(uid).emit("yourHand", room.players[uid].hand);
  }

  updateHandCounts(room);
  io.to(room.roomId).emit("turnChange", room.turnOrder[0]);
}

// =================================================================
// 턴 변경
// =================================================================
function nextTurn(room) {
  room.currentTurnIndex =
    (room.currentTurnIndex + 1) % room.turnOrder.length;

  io.to(room.roomId).emit(
    "turnChange",
    room.turnOrder[room.currentTurnIndex]
  );
}

// =================================================================
// 손패 개수 갱신
// =================================================================
function updateHandCounts(room) {
  const counts = {};
  for (const uid in room.players) {
    counts[uid] = room.players[uid].handCount;
  }
  io.to(room.roomId).emit("handCountUpdate", counts);
}
