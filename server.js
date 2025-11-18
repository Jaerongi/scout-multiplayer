// =============================
// SCOUT MULTIPLAYER – server.js (RAILWAY OK VERSION)
// =============================
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 반드시 public 절대 경로 지정
app.use(express.static(path.join(__dirname, "public")));

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",   // Railway에서 반드시 필요
    methods: ["GET", "POST"]
  }
});

// =========================================
// In-memory Data
// =========================================
const rooms = {};
const players = {};

// =========================================
// Deck 45장 생성
// =========================================
function createDeck() {
  const deck = [];
  for (let top = 1; top <= 9; top++) {
    for (let bottom = 1; bottom <= 5; bottom++) {
      deck.push({ top, bottom });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

// =========================================
// SOCKET EVENTS
// =========================================
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinRoom", ({ roomId, nickname }) => {
    socket.join(roomId);

    players[socket.id] = {
      nickname,
      hand: [],
      pendingScoutCard: null
    };

    if (!rooms[roomId]) {
      rooms[roomId] = {
        deck: createDeck(),
        tableCards: [],
        turn: null
      };
    }

    io.to(roomId).emit("updatePlayers", players);
  });

  // 게임 시작
  socket.on("startGame", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    Object.keys(players).forEach((id) => {
      players[id].hand = room.deck.splice(0, 10);
    });

    room.turn = Object.keys(players)[0];

    io.to(roomId).emit("gameStarted", { players, room });
  });

  // SCOUT: 뒤집기 여부 먼저 선택
  socket.on("scoutTake", ({ reversed, roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const taken = room.tableCards.shift();
    if (!taken) return;

    let card = reversed
      ? { top: taken.bottom, bottom: taken.top }
      : taken;

    players[socket.id].pendingScoutCard = card;

    io.to(roomId).emit("awaitInsertPosition", {
      playerId: socket.id,
      card
    });
  });

  // SCOUT: +넣을 위치 선택
  socket.on("insertCardAt", ({ index, roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const card = players[socket.id].pendingScoutCard;
    if (!card) return;

    players[socket.id].hand.splice(index, 0, card);
    delete players[socket.id].pendingScoutCard;

    io.to(roomId).emit("updateHands", players);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

// =========================================
// Railway Port Listen FIX
// =========================================
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log("🚀 Server running on PORT:", PORT);
});
