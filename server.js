// server.js
import express from "express";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

// SCOUT 규칙 모듈
import {
  SCOUT_DECK,
  shuffle,
  dealForMultiplayer,
  getComboType,
  isStrongerCombo
} from "./public/shared.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 정적 파일
app.use(express.static(path.join(__dirname, "public")));

let rooms = {}; // 모든 방 저장

/* ============================================================
   유저 입장
============================================================ */
io.on("connection", (socket) => {

  /* ---------------------------------------------------------
     방 입장 (start.html → room.html)
  ---------------------------------------------------------*/
  socket.on("joinRoom", ({ roomId, nickname }) => {
    socket.join(roomId);

    // 방 없으면 생성
    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        round: 1,
        players: {},
        deck: [],
        tableCards: [],
        turnOrder: [],
        currentTurnIndex: 0,
        startingPlayerIndex: 0,
        maxRounds: 0
      };
    }

    // 방 첫 번째 유저 → 방장
    const isHost = Object.keys(rooms[roomId].players).length === 0;

    rooms[roomId].players[socket.id] = {
      uid: socket.id,
      nickname,
      ready: false,
      isHost,
      hand: [],
      handCount: 0,
      coins: 0,
      score: 0
    };

    rooms[roomId].maxRounds = Object.keys(rooms[roomId].players).length;

    io.to(roomId).emit("playerListUpdate", rooms[roomId].players);
  });

  /* ---------------------------------------------------------
     READY
  ---------------------------------------------------------*/
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[socket.id].ready = true;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  /* ---------------------------------------------------------
     방장 → 게임 시작
  ---------------------------------------------------------*/
  socket.on("forceStartGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const allReady = Object.values(room.players).every(p => p.ready);
    if (!allReady) return;

    // 모든 사람에게 game.html로 이동하라는 신호
    io.to(roomId).emit("goGame");

    // 딜레이 후 실제 라운드 시작
    setTimeout(() => startRound(room), 300);
  });

  /* ---------------------------------------------------------
     SHOW
  ---------------------------------------------------------*/
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;
    const currentUid = room.turnOrder[room.currentTurnIndex];

    if (uid !== currentUid) {
      socket.emit("errorMessage", "당신의 턴이 아닙니다.");
      return;
    }

    const type = getComboType(cards);
    if (type === "invalid") {
      socket.emit("errorMessage", "세트/런이 아닙니다.");
      return;
    }

    if (!isStrongerCombo(cards, room.tableCards)) {
      socket.emit("errorMessage", "기존 테이블보다 약합니다.");
      return;
    }

    room.tableCards = cards;
    room.players[uid].handCount -= cards.length;

    if (checkWinner(room, uid)) return;

    nextTurn(room);

    io.to(roomId).emit("tableUpdate", room.tableCards);
    io.to(roomId).emit("turnChange", room.turnOrder[room.currentTurnIndex]);
    updateHandCounts(room);
  });

  /* ---------------------------------------------------------
     SCOUT
  ---------------------------------------------------------*/
  socket.on("scout", ({ roomId, chosenValue }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.tableCards.length !== 1) {
      socket.emit("errorMessage", "스카우트는 1장일 때만 가능합니다.");
      return;
    }

    const uid = socket.id;
    const t = room.tableCards[0];

    const card =
      chosenValue === "top"
        ? { top: t.top, bottom: t.bottom }
        : { top: t.bottom, bottom: t.top };

    room.players[uid].handCount++;
    room.players[uid].coins++;
    room.tableCards = [];

    if (checkWinner(room, uid)) return;

    nextTurn(room);

    io.to(roomId).emit("tableUpdate", room.tableCards);
    io.to(roomId).emit("turnChange", room.turnOrder[room.currentTurnIndex]);
    updateHandCounts(room);
  });

  /* ---------------------------------------------------------
     PASS
  ---------------------------------------------------------*/
  socket.on("pass", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    nextTurn(room);

    io.to(roomId).emit("turnChange", room.turnOrder[room.currentTurnIndex]);
  });

  /* ============================================================
     🔥 유저 disconnect 처리 (핵심)
============================================================ */
  socket.on("disconnect", () => {
    console.log(`유저 퇴장: ${socket.id}`);

    for (const roomId in rooms) {
      const room = rooms[roomId];

      // 방에 속한 유저인가?
      if (room.players[socket.id]) {
        delete room.players[socket.id];

        // 방이 비었으면 방 삭제
        if (Object.keys(room.players).length === 0) {
          delete rooms[roomId];
          continue;
        }

        // 턴 순서에서 제거
        room.turnOrder = room.turnOrder.filter(uid => uid !== socket.id);

        // 턴 보정
        if (room.currentTurnIndex >= room.turnOrder.length) {
          room.currentTurnIndex = 0;
        }

        // 모든 유저에게 업데이트
        io.to(roomId).emit("playerListUpdate", room.players);
        io.to(roomId).emit("turnChange", room.turnOrder[room.currentTurnIndex]);
      }
    }
  });

});

/* ============================================================
   FUNCTIONS
============================================================ */

function startRound(room) {
  const uids = Object.keys(room.players);
  const pCount = uids.length;

  const { hands, deck } = dealForMultiplayer(pCount);

  room.deck = deck;
  room.tableCards = [];

  for (let i = 0; i < pCount; i++) {
    const uid = uids[i];
    room.players[uid].hand = hands[i];
    room.players[uid].handCount = hands[i].length;
    room.players[uid].coins = 0;
  }

  room.turnOrder = uids;
  room.currentTurnIndex =
    room.startingPlayerIndex % pCount;

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[room.currentTurnIndex]
  });

  updateHandCounts(room);
}

function checkWinner(room, uid) {
  if (room.players[uid].handCount === 0) {
    finishRound(room, uid);
    return true;
  }
  return false;
}

function finishRound(room, winnerUid) {
  const players = room.players;

  for (const uid in players) {
    if (uid !== winnerUid) {
      players[uid].score -= players[uid].handCount;
    }
    players[uid].score += players[uid].coins;
  }

  io.to(room.roomId).emit("roundEnded", {
    winner: players[winnerUid].nickname,
    players
  });

  room.round++;

  if (room.round > room.maxRounds) {
    io.to(room.roomId).emit("gameEnd", { players });
    return;
  }

  room.startingPlayerIndex++;
  startRound(room);
}

function nextTurn(room) {
  room.currentTurnIndex =
    (room.currentTurnIndex + 1) % room.turnOrder.length;
}

function updateHandCounts(room) {
  const counts = {};
  for (const uid in room.players) {
    counts[uid] = room.players[uid].handCount;
  }
  io.to(room.roomId).emit("handCountUpdate", counts);
}

/* ============================================================
   서버 시작
============================================================ */
server.listen(3000, "0.0.0.0", () => {
  console.log("🔥 SCOUT Multiplayer server running on :3000");
});
