// ================================
// SCOUT MULTIPLAYER — FULL PACKAGE (PERMUID FIX APPLIED)
// 선한피클님 요청: 초대링크 입장 시 permUid 신규 생성 버전
// 이 파일 하나에 모든 파일 코드 포함됨
// ================================

============================================================
== FILE 1: server.js
============================================================

// =====================================================
// SCOUT MULTIPLAYER — ULTIMATE SERVER FINAL
// (재접속 복구 + 오프라인 스킵 + SCOUT 규칙 + 안정성 패치)
// =====================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { getComboType, isStrongerCombo } from "./shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));
app.get("/shared.js", (req, res) => res.sendFile(process.cwd() + "/shared.js"));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log("SERVER START", PORT));

const rooms = {};

function createDeck() {
  const deck = [];
  for (let t = 1; t <= 9; t++) {
    for (let b = t + 1; b <= 10; b++) deck.push({ top: t, bottom: b });
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

  if (playerCount === 3)
    deck = deck.filter(c => c.top !== 10 && c.bottom !== 10);

  if (playerCount === 2 || playerCount === 4)
    while (deck.length > 44) deck.pop();

  const drop = deck.length % playerCount;
  for (let i = 0; i < drop; i++) deck.pop();

  const size = deck.length / playerCount;
  const res = [];

  for (let i = 0; i < playerCount; i++) {
    let hand = deck.splice(0, size);
    hand = hand.map(c =>
      Math.random() < 0.5 ? c : { top: c.bottom, bottom: c.top }
    );
    res.push(hand);
  }
  return res;
}

io.on("connection", (socket) => {

  socket.on("joinRoom", ({ roomId, nickname, permUid }) => {
    if (!roomId || !nickname || !permUid) return;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        players: {},
        turnOrder: [],
        currentTurn: 0,
        table: [],
        round: 1,
        host: null,
        lastShowPlayer: null
      };
    }

    const room = rooms[roomId];
    const isFirst = Object.keys(room.players).length === 0;

    if (!room.players[permUid]) {
      room.players[permUid] = {
        uid: permUid,
        nickname,
        socketId: socket.id,
        isHost: isFirst,
        ready: false,
        hand: [],
        score: 0,
        isOnline: true
      };
      if (isFirst) room.host = permUid;
    } else {
      room.players[permUid].socketId = socket.id;
      room.players[permUid].isOnline = true;
    }

    io.to(roomId).emit("playerListUpdate", room.players);

    const gameStarted = room.turnOrder.length > 0;
    const p = room.players[permUid];

    if (gameStarted) {
      io.to(socket.id).emit("restoreState", {
        hand: p.hand,
        score: p.score,
        table: room.table,
        round: room.round,
        players: room.players,
        turn: room.turnOrder[room.currentTurn]
      });
    }
  });

  socket.on("playerReady", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (!room.players[permUid].isHost)
      room.players[permUid].ready = !room.players[permUid].ready;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  socket.on("startGame", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.host !== permUid) return;

    const readyOK = Object.values(room.players)
      .filter(p => !p.isHost)
      .every(p => p.ready);

    if (!readyOK) return;

    startRound(room);
    io.to(roomId).emit("goGamePage");
  });

  socket.on("confirmFlip", ({ roomId, permUid, flipped }) => {
    const room = rooms[roomId];
    if (room) room.players[permUid].hand = flipped;
  });

  socket.on("show", ({ roomId, permUid, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[permUid];

    player.score += room.table.length;

    player.hand = player.hand.filter(
      h => !cards.some(c => c.top === h.top && c.bottom === h.bottom)
    );

    room.table = cards;
    room.lastShowPlayer = permUid;

    io.to(player.socketId).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

  socket.on("scout", ({ roomId, permUid, side, flip, pos }) => {
    const room = rooms[roomId];
    if (!room || room.table.length === 0) return;

    const player = room.players[permUid];

    let card;
    if (room.table.length === 1) card = room.table.pop();
    else card = side === "left" ? room.table.shift() : room.table.pop();

    if (flip) card = { top: card.bottom, bottom: card.top };

    pos = Math.max(0, Math.min(player.hand.length, pos));
    player.hand.splice(pos, 0, card);

    if (room.lastShowPlayer && room.lastShowPlayer !== permUid)
      room.players[room.lastShowPlayer].score += 1;

    io.to(player.socketId).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

  socket.on("disconnect", () => {
    for (const rid in rooms) {
      const room = rooms[rid];
      for (const p of Object.values(room.players)) {
        if (p.socketId === socket.id) p.isOnline = false;
      }
      io.to(rid).emit("playerListUpdate", room.players);
    }
  });
});

function startRound(room) {
  const uids = Object.keys(room.players);
  const hands = deal(uids.length);

  uids.forEach((uid, i) => {
    room.players[uid].hand = hands[i];
  });

  room.turnOrder = [...uids];
  room.currentTurn = 0;
  room.table = [];
  room.lastShowPlayer = null;

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[0]
  });

  uids.forEach(uid => {
    const p = room.players[uid];
    if (p.isOnline) io.to(p.socketId).emit("yourHand", p.hand);
  });

  io.to(room.roomId).emit("turnChange", room.turnOrder[0]);
}

function nextTurn(room) {
  for (let i = 0; i < room.turnOrder.length; i++) {
    room.currentTurn = (room.currentTurn + 1) % room.turnOrder.length;

    const uid = room.turnOrder[room.currentTurn];
    const p = room.players[uid];

    if (!p.isOnline) continue;

    if (room.lastShowPlayer && uid === room.lastShowPlayer) {
      const winner = room.lastShowPlayer;

      for (const u of Object.keys(room.players)) {
        if (u !== winner)
          room.players[u].score -= room.players[u].hand.length;
      }

      io.to(room.roomId).emit("roundEnd", {
        winner,
        players: room.players
      });

      room.round++;
      startRound(room);
      return;
    }

    io.to(room.roomId).emit("turnChange", uid);
    return;
  }
}
