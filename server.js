import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import { isStrongerCombo } from "./public/shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log("SERVER RUNNING:", PORT));

const rooms = {};

function createDeck() {
  const deck = [];
  for (let top = 1; top <= 10; top++) {
    for (let bottom = 1; bottom <= 10; bottom++) {
      if (top !== bottom) deck.push({ top, bottom });
    }
  }
  return deck;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dealForMultiplayer(players) {
  const deck = shuffle(createDeck());
  const count = players.length;
  const per = Math.floor(deck.length / count);

  const hands = [];
  for (let i = 0; i < count; i++) {
    hands.push(deck.slice(i * per, i * per + per));
  }
  return hands;
}

io.on("connection", (socket) => {
  
  socket.on("joinRoom", ({ roomId, nickname }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        players: {},
        table: [],
        turnOrder: [],
        turnIndex: 0
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

  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[socket.id].ready =
      !room.players[socket.id].ready;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  socket.on("forceStartGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const pids = Object.keys(room.players);
    room.turnOrder = pids;
    room.turnIndex = 0;

    const hands = dealForMultiplayer(pids);

    pids.forEach((uid, index) => {
      room.players[uid].hand = hands[index];
      room.players[uid].handCount = hands[index].length;
    });

    io.to(roomId).emit("roundStart", {
      round: 1,
      players: room.players,
      startingPlayer: room.turnOrder[0]
    });

    pids.forEach(uid => {
      io.to(uid).emit("yourHand", room.players[uid].hand);
    });

    io.to(roomId).emit("turnChange", room.turnOrder[0]);
  });

  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.table = cards;

    const me = room.players[socket.id];

    me.hand = me.hand.filter(c =>
      !cards.some(x => x.top === c.top && x.bottom === c.bottom)
    );

    me.handCount = me.hand.length;

    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("handCountUpdate", {
      [socket.id]: me.handCount
    });

    nextTurn(room);
  });

  socket.on("scout", ({ roomId, chosenValue }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.table.length !== 1) return;

    const base = room.table[0];

    const card =
      chosenValue === "bottom"
        ? { top: base.bottom, bottom: base.top }
        : { top: base.top, bottom: base.bottom };

    room.players[socket.id].hand.push(card);
    room.players[socket.id].handCount++;

    room.table = [];
    io.to(roomId).emit("tableUpdate", room.table);

    nextTurn(room);
  });

  socket.on("pass", ({ roomId }) => {
    const room = rooms[roomId];
    nextTurn(room);
  });

});

function nextTurn(room) {
  room.turnIndex = (room.turnIndex + 1) % room.turnOrder.length;
  const next = room.turnOrder[room.turnIndex];
  io.to(room.roomId).emit("turnChange", next);
}
