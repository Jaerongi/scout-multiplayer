// ================================
// SCOUT MULTIPLAYER – SERVER (ESM)
// ================================
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

// __dirname 구현 (ESM에서 필요)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// socket.io 생성
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// public 정적 파일 서빙
app.use(express.static(path.join(__dirname, "public")));

// 기본 라우트 → index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 포트
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🔥 SCOUT SERVER RUNNING: ${PORT}`);
});

// ======================================
// 게임 데이터 저장 구조
// ======================================
const rooms = {};

// --------------------------------------
// 카드 덱 생성
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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

import { SCOUT_DECK } from "./public/shared.js";   // 반드시 추가

function dealForMultiplayer(playerCount) {

  // SCOUT 공식 44장 복사 + 셔플
  let deck = shuffle([...SCOUT_DECK]);

  // =============== 3명 플레이어 ===============
  if (playerCount === 3) {
    // top 또는 bottom에 10이 들어있는 카드 제거
    deck = deck.filter(c => c.top !== 10 && c.bottom !== 10);
    // 남은 카드 총 35장 → 12장씩 배분
    const hands = [];
    for (let i = 0; i < 3; i++) {
      hands.push(deck.slice(i*12, i*12+12));
    }
    return { hands, deck: [] };
  }

  // =============== 2~4명 (3명 제외) ===============
  if (playerCount >= 2 && playerCount <= 4) {
    // 9/10 또는 10/9 카드 1장 제거
    const removeIndex = deck.findIndex(
      (c) =>
        (c.top === 9 && c.bottom === 10) ||
        (c.top === 10 && c.bottom === 9)
    );
    if (removeIndex >= 0) deck.splice(removeIndex, 1);

    // 남은 43장 → n명에게 균등분배
    const each = Math.floor(deck.length / playerCount);
    const hands = [];
    let start = 0;
    for (let i = 0; i < playerCount; i++) {
      hands.push(deck.slice(start, start + each));
      start += each;
    }

    return { hands, deck: deck.slice(start) };
  }

  // =============== 5명 이상 ===============
  if (playerCount === 5) {
    // 44장 그대로 사용
    const each = Math.floor(deck.length / 5); // 8장씩
    const hands = [];
    for (let i = 0; i < 5; i++) {
      hands.push(deck.slice(i*each, i*each+each));
    }
    deck = deck.slice(5*each);
    return { hands, deck };
  }

  // 그 외 플레이어 수 방어코드
  return { hands: [], deck };
}


// ======================================
// SOCKET.IO LOGIC
// ======================================
io.on("connection", (socket) => {
  console.log("🟢 CONNECT:", socket.id);

  // 방 참여
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
      score: 0
    };

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // READY
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[socket.id].ready = !room.players[socket.id].ready;
    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // 게임 시작
  socket.on("forceStartGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    io.to(roomId).emit("goGame");

    setTimeout(() => startRound(room), 500);
  });

// ------------------------------
// SHOW (패 내기)
// ------------------------------
socket.on("show", ({ roomId, cards }) => {
  const room = rooms[roomId];
  if (!room) return;
  const uid = socket.id;

  const player = room.players[uid];
  if (!player) return;

  // 🔥 1) 기존 테이블 카드 수 → 점수
  const previousCount = room.tableCards.length;

  // 🔥 2) 테이블 갱신
  room.tableCards = cards;

  // 🔥 3) 내 패(CARD) 제거
  player.hand = player.hand.filter(
    (c) =>
      !cards.some(
        (cc) => cc.top === c.top && cc.bottom === c.bottom
      )
  );
  player.handCount = player.hand.length;

  // 🔥 4) 점수 추가
  player.score += previousCount;

  // 🔥 5) 클라이언트 업데이트
  io.to(roomId).emit("tableUpdate", room.tableCards);
  io.to(roomId).emit("playerListUpdate", room.players);
  updateHandCounts(room);

  // ⭐⭐ 여기 추가 — 내 패 전체 다시 전송
  io.to(uid).emit("yourHand", player.hand);

  // 🔥 6) 턴 넘김
  nextTurn(room);
});



  // SCOUT
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

    room.tableCards = [];
    io.to(roomId).emit("tableUpdate", room.tableCards);

    updateHandCounts(room);
    nextTurn(room);
  });

  // PASS
  socket.on("pass", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    nextTurn(room);
  });

  // DISCONNECT
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
  }

  room.turnOrder = uids;
  room.currentTurnIndex = 0;

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[0]
  });

  // 개별 패 전달
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



