// ===============================================
// SCOUT MULTIPLAYER – SERVER (최종본)
// ===============================================
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import {
  isStrongerCombo
} from "./public/shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log("SERVER RUN", PORT));

// ===============================================
// 방 구조
// ===============================================
const rooms = {}; // roomId → roomState

// ===============================================
// 카드 44장 생성 (중복 제거됨)
// ===============================================
function createDeck() {
  const deck = [];
  for (let top = 1; top <= 10; top++) {
    for (let bottom = 1; bottom <= 10; bottom++) {
      if (top !== bottom) deck.push({ top, bottom });
    }
  }
  return deck;
}

// Fisher–Yates
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===============================================
// 인원수 맞게 패 분배
// ===============================================
function dealProper(playerCount) {
  let deck = shuffle(createDeck());

  // ★ 3명일 때 10이 포함된 카드 제거
  if (playerCount === 3) {
    deck = deck.filter(c => c.top !== 10 && c.bottom !== 10);
  }

  // ★ 카드 수가 9/10 또는 10/9인 경우 → 1장 제거해서 정확히 분배
  while (deck.length % playerCount !== 0) {
    deck.pop();
  }

  const per = deck.length / playerCount;
  const hands = [];

  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.slice(i * per, i * per + per));
  }

  return hands;
}

// ===============================================
// SOCKET IO
// ===============================================
io.on("connection", (socket) => {

  // ------------------------------
  // 방 입장
  // ------------------------------
  socket.on("joinRoom", ({ roomId, nickname }) => {
    if (!roomId || !nickname) return;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        players: {},
        table: [],
        starting: false,
      };
    }

    const room = rooms[roomId];
    const isHost = Object.keys(room.players).length === 0;

    room.players[socket.id] = {
      uid: socket.id,
      nickname,
      isHost,
      hand: [],
      handConfirmed: false,
      handCount: 0,
      score: 0,
    };

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // ------------------------------
  // 패 방향 확정
  // ------------------------------
  socket.on("confirmHand", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[socket.id].handConfirmed = true;

    io.to(roomId).emit("handConfirmUpdate", room.players);
  });

  // ------------------------------
  // 게임 시작
  // ------------------------------
  socket.on("forceStartGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const ids = Object.keys(room.players);
    const hands = dealProper(ids.length);

    ids.forEach((uid, i) => {
      room.players[uid].hand = hands[i];
      room.players[uid].handCount = hands[i].length;
    });

    room.table = []; 
    room.turnOrder = ids;
    room.turnIndex = 0;

    io.to(roomId).emit("roundStart", {
      round: 1,
      players: room.players,
      startingPlayer: room.turnOrder[0],
    });

    ids.forEach(uid => {
      io.to(uid).emit("yourHand", room.players[uid].hand);
    });

    io.to(roomId).emit("turnChange", room.turnOrder[0]);
  });

  // ------------------------------
  // SHOW
  // ------------------------------
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;
    const me = room.players[uid];

    // 카드 제거
    me.hand = me.hand.filter(h =>
      !cards.some(c => c.top === h.top && c.bottom === h.bottom)
    );
    me.handCount = me.hand.length;

    // 테이블 업데이트
    room.table = cards;

    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

  // ------------------------------
  // SCOUT — 양끝
  // ------------------------------
  socket.on("scout", ({ roomId, side, chosen }) => {
    const room = rooms[roomId];
    if (!room) return;

    const t = room.table;
    if (t.length === 0) return;

    let base =
      side === "left"
        ? t[0]
        : t[t.length - 1];

    const card = 
      chosen === "bottom"
        ? { top: base.bottom, bottom: base.top }
        : { top: base.top, bottom: base.bottom };

    const me = room.players[socket.id];

    me.hand.push(card);
    me.handCount++;

    // 테이블에서 제거
    if (side === "left") t.shift();
    else t.pop();

    io.to(roomId).emit("tableUpdate", t);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

});

// ===============================================
// TURN 이동
// ===============================================
function nextTurn(room) {
  room.turnIndex = (room.turnIndex + 1) % room.turnOrder.length;
  const next = room.turnOrder[room.turnIndex];
  io.to(room.roomId).emit("turnChange", next);
}
