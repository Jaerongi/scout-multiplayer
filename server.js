// =============================
// SCOUT MULTIPLAYER – server.js
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
  console.log("SERVER START", PORT);
});

const rooms = {};

// ------------------------------------
// 카드 생성 (full deck)
// ------------------------------------
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

function deal(playerCount) {
  let deck = shuffle(createDeck());

  // 인원수 조건
  if (playerCount === 3) {
    deck = deck.filter((c) => c.top !== 10 && c.bottom !== 10);
  }

  const needRemove = deck.length % playerCount;
  for (let i = 0; i < needRemove; i++) deck.pop();

  const size = deck.length / playerCount;
  const hands = [];

  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.splice(0, size));
  }

  return hands;
}

// ------------------------------------
// CONNECTION
// ------------------------------------
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  socket.on("joinRoom", ({ roomId, nickname }) => {
    if (!roomId || !nickname) return;

    socket.join(roomId);

    // 방 생성
    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        players: {},
        turnOrder: [],
        currentTurnIndex: 0,
        tableCards: [],
        round: 1,
        host: null
      };
    }

    const room = rooms[roomId];
    const isFirst = Object.keys(room.players).length === 0;

    // 플레이어 등록
    room.players[socket.id] = {
      uid: socket.id,
      nickname,
      isHost: isFirst,
      ready: false,
      hand: [],
      score: 0
    };

    if (isFirst) room.host = socket.id;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // READY
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.players[socket.id].isHost) return;

    room.players[socket.id].ready = !room.players[socket.id].ready;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // START
  socket.on("startGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.host !== socket.id) return;

    const allReady = Object.values(room.players)
      .filter((p) => !p.isHost)
      .every((p) => p.ready);

    if (!allReady) {
      io.to(socket.id).emit("errorMessage", "모두 준비 완료가 아닙니다!");
      return;
    }

    startRound(room);
    io.to(roomId).emit("goGamePage");
  });

  // confirmer flip
  socket.on("confirmFlip", ({ roomId, flipped }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[socket.id].hand = flipped;
  });

  // SHOW
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;
  
    const uid = socket.id;
    const player = room.players[uid];
  
    // remove selected cards from hand
    player.hand = player.hand.filter(
      (h) => !cards.some(c => h.top === c.top && h.bottom === c.bottom)
    );
  
    player.score += cards.length;
  
    room.tableCards = cards;
  
    io.to(roomId).emit("tableUpdate", cards);
    io.to(roomId).emit("playerListUpdate", room.players);
  
    nextTurn(room);
});


  // SCOUT
  socket.on("scout", ({ roomId, side }) => {
    const room = rooms[roomId];
    if (!room) return;

    const take =
      side === "left"
        ? room.tableCards.shift()
        : room.tableCards.pop();

    if (!take) return;

    room.players[socket.id].hand.push(take);

    io.to(roomId).emit("tableUpdate", room.tableCards);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

  // disconnect
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

// --------------------------
function startRound(room) {
  const uids = Object.keys(room.players);
  const hands = deal(uids.length);

  for (let i = 0; i < uids.length; i++) {
    room.players[uids[i]].hand = hands[i];
  }

  room.turnOrder = uids;
  room.currentTurnIndex = 0;
  room.tableCards = [];

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[0]
  });

  uids.forEach((uid) => {
    io.to(uid).emit("yourHand", room.players[uid].hand);
  });

  io.to(room.roomId).emit("turnChange", room.turnOrder[0]);
}

function nextTurn(room) {
  room.currentTurnIndex =
    (room.currentTurnIndex + 1) % room.turnOrder.length;

  const next = room.turnOrder[room.currentTurnIndex];
  io.to(room.roomId).emit("turnChange", next);
}

