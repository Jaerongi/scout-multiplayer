// =============================
// SCOUT MULTIPLAYER - SERVER
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
  console.log("SERVER START :", PORT);
});

// -----------------------------
// 방 구조
// -----------------------------
const rooms = {};

// -----------------------------
// 카드 44장 생성
// -----------------------------
function createDeck() {
  const deck = [];
  for (let top = 1; top <= 10; top++) {
    for (let bottom = 1; bottom <= 10; bottom++) {
      if (top !== bottom) deck.push({ top, bottom });
    }
  }
  return deck;
}

// -----------------------------
// 카드 셔플
// -----------------------------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// -----------------------------
// 다인용 카드 분배
// -----------------------------
function dealForMultiplayer(playerCount) {
  const deck = shuffle(createDeck());
  const handSize = Math.floor(deck.length / playerCount);

  const hands = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.splice(0, handSize));
  }
  return { hands, deck };
}

// =========================================================
// SOCKET CORE
// =========================================================
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  // -----------------------------
  // 방 입장
  // -----------------------------
  socket.on("joinRoom", ({ roomId, nickname }) => {
    if (!roomId || !nickname) return;

    socket.join(roomId);

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

    const room = rooms[roomId];
    const isHost = Object.keys(room.players).length === 0;

    room.players[socket.id] = {
      uid: socket.id,
      nickname,
      ready: false,
      isHost,
      hand: [],
      handCount: 0,
      coins: 0,
      score: 0
    };

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // -----------------------------
  // READY
  // -----------------------------
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.players[socket.id]) {
      room.players[socket.id].ready = !room.players[socket.id].ready;
    }

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // -----------------------------
  // 게임 시작 (방장)
  // -----------------------------
  socket.on("forceStartGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    // 1) 모든 플레이어 게임 화면으로 이동
    io.to(roomId).emit("goGame");

    // 2) game.html 로딩 시간 확보 후 라운드 시작
    setTimeout(() => {
      startRound(room);
    }, 300);
  });

  // -----------------------------
  // SHOW
  // -----------------------------
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.tableCards = cards;

    const uid = socket.id;
    const player = room.players[uid];

    // 손패 제거
    player.hand = player.hand.filter((c) => {
      return !cards.some(
        cs => (cs.top === c.top && cs.bottom === c.bottom)
      );
    });
    player.handCount = player.hand.length;

    io.to(roomId).emit("tableUpdate", room.tableCards);
    updateHandCounts(room);
    nextTurn(room);
  });

  // -----------------------------
  // SCOUT
  // -----------------------------
  socket.on("scout", ({ roomId, chosenValue }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.tableCards.length !== 1) return;

    const card = room.tableCards[0];
    const takeValue = (chosenValue === "bottom")
      ? { top: card.bottom, bottom: card.top }
      : { top: card.top, bottom: card.bottom };

    room.players[socket.id].hand.push(takeValue);
    room.players[socket.id].handCount++;

    room.tableCards = [];
    io.to(roomId).emit("tableUpdate", room.tableCards);

    nextTurn(room);
  });

  // -----------------------------
  // PASS
  // -----------------------------
  socket.on("pass", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    nextTurn(room);
  });

  // -----------------------------
  // 연결 종료
  // -----------------------------
  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(roomId).emit("playerListUpdate", room.players);
      }
    }
  });
});

/* ============================================================
   ROUND MANAGEMENT
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
  room.currentTurnIndex = room.startingPlayerIndex % pCount;

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[room.currentTurnIndex]
  });

  // 🔥 패 전달
  for (let i = 0; i < pCount; i++) {
    const uid = uids[i];
    io.to(uid).emit("yourHand", room.players[uid].hand);
  }

  updateHandCounts(room);
  io.to(room.roomId).emit(
    "turnChange",
    room.turnOrder[room.currentTurnIndex]
  );
}

/* ============================================================
   턴 넘기기
============================================================ */
function nextTurn(room) {
  room.currentTurnIndex =
    (room.currentTurnIndex + 1) % room.turnOrder.length;

  const current = room.turnOrder[room.currentTurnIndex];

  io.to(room.roomId).emit("turnChange", current);
}

/* ============================================================
   손패 갱신
============================================================ */
function updateHandCounts(room) {
  const counts = {};
  for (const uid in room.players) {
    counts[uid] = room.players[uid].handCount;
  }
  io.to(room.roomId).emit("handCountUpdate", counts);
}
