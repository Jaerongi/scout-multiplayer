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

const rooms = {};
const players = {};

// =========================================
// 공식 SCOUT 덱 45장
// =========================================
function createDeck() {
  const deck = [];
  for (let top = 1; top <= 9; top++) {
    for (let bottom = 1; bottom <= 5; bottom++) {
      deck.push({ top, bottom }); // 예시
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

// =========================================
// 소켓 연결
// =========================================
io.on("connection", (socket) => {

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

  // 스카우트 가져오기 선택 끝 → 서버에 저장
  socket.on("scoutTake", ({ reversed }, roomId) => {
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

  // +넣기 index 지정
  socket.on("insertCardAt", ({ index, roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const card = players[socket.id].pendingScoutCard;
    if (!card) return;

    players[socket.id].hand.splice(index, 0, card);
    delete players[socket.id].pendingScoutCard;

    io.to(roomId).emit("updateHands", players);
  });
});

httpServer.listen(3000, () => {
  console.log("Server running on port 3000");
});
