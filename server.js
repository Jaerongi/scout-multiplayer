// =====================================
// SCOUT MULTIPLAYER SERVER (최종본)
// =====================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

server.listen(PORT, () => {
  console.log("SCOUT SERVER START:", PORT);
});

// =====================================
// 방 구조
// =====================================
const rooms = {};

// 공식 44장 덱
const deck44 = [
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

// --------------------------
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(playerCount) {
  let deck = shuffle(deck44);
  const hands = [];

  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.slice(i*11, i*11+11));
  }
  deck = deck.slice(playerCount * 11);
  return { hands, deck };
}

// =====================================
// SOCKET.IO
// =====================================
io.on("connection", (sock) => {

  // ------------------------
  // joinRoom
  // ------------------------
  sock.on("joinRoom", ({ roomId, nickname }) => {

    sock.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: {},
        round: 1,
        table: [],
        turnIdx: 0,
      };
    }

    const room = rooms[roomId];

    const isHost = Object.keys(room.players).length === 0;

    room.players[sock.id] = {
      uid: sock.id,
      nickname,
      isHost,
      ready: false,
      score: 0,
      hand: [],
      handCount: 0,
      isTurn: false,
    };

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // ------------------------
  // READY
  // ------------------------
  sock.on("toggleReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.players[sock.id]) return;

    room.players[sock.id].ready = !room.players[sock.id].ready;
    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // ------------------------
  // START GAME
  // ------------------------
  sock.on("startGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const playerIds = Object.keys(room.players);
    const { hands } = deal(playerIds.length);

    room.turnIdx = 0;
    room.table = [];

    playerIds.forEach((uid, i) => {
      room.players[uid].hand = hands[i];
      room.players[uid].handCount = hands[i].length;
      room.players[uid].isTurn = false;

      io.to(uid).emit("yourHand", room.players[uid].hand);
    });

    const first = playerIds[0];
    room.players[first].isTurn = true;

    io.to(roomId).emit("roundStart", {
      round: room.round,
      players: room.players,
      startingPlayer: first
    });

    updateHandCounts(roomId);
    io.to(roomId).emit("turnChange", first);
  });

  // ------------------------
  // SHOW
  // ------------------------
  sock.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.table = cards;

    // remove from hand
    const p = room.players[sock.id];
    p.hand = p.hand.filter(
      (h) => !cards.some((c) => h.top === c.top && h.bottom === c.bottom)
    );
    p.handCount = p.hand.length;

    io.to(roomId).emit("tableUpdate", room.table);
    updateHandCounts(roomId);

    nextTurn(roomId);
  });

  // ------------------------
  // SCOUT
  // ------------------------
  sock.on("scout", ({ roomId, chosenValue }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.table.length !== 1) return;

    const t = room.table[0];
    const card =
      chosenValue === "bottom"
        ? { top: t.bottom, bottom: t.top }
        : { top: t.top, bottom: t.bottom };

    room.players[sock.id].hand.push(card);
    room.players[sock.id].handCount++;

    room.table = [];
    io.to(roomId).emit("tableUpdate", []);

    updateHandCounts(roomId);
    nextTurn(roomId);
  });

  // ------------------------
  // PASS
  // ------------------------
  sock.on("pass", ({ roomId }) => {
    nextTurn(roomId);
  });

  // ------------------------
  // disconnect
  // ------------------------
  sock.on("disconnect", () => {
    for (const rid in rooms) {
      const room = rooms[rid];
      if (room.players[sock.id]) {
        delete room.players[sock.id];
        io.to(rid).emit("playerListUpdate", room.players);
      }
    }
  });
});

// =====================================
// 공통 함수
// =====================================
function updateHandCounts(roomId) {
  const room = rooms[roomId];
  const data = {};

  for (const uid in room.players) {
    data[uid] = room.players[uid].handCount;
  }

  io.to(roomId).emit("handCountUpdate", data);
}

function nextTurn(roomId) {
  const room = rooms[roomId];

  const ids = Object.keys(room.players);
  room.turnIdx = (room.turnIdx + 1) % ids.length;
  const next = ids[room.turnIdx];

  Object.values(room.players).forEach((p) => (p.isTurn = false));
  room.players[next].isTurn = true;

  io.to(roomId).emit("turnChange", next);
}
