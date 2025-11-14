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

function dealForMultiplayer(playerCount) {
  const deck = shuffle(createDeck());
  const hands = [];
  const handSize = Math.floor(deck.length / playerCount);

  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.splice(0, handSize));
  }

  return { hands, deck };
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

  // SHOW
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;

    room.tableCards = cards;

    room.players[uid].hand = room.players[uid].hand.filter(
      (c) => !cards.some(cs => cs.top === c.top && cs.bottom === c.bottom)
    );

    room.players[uid].handCount = room.players[uid].hand.length;

    io.to(roomId).emit("tableUpdate", room.tableCards);
    updateHandCounts(room);
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
