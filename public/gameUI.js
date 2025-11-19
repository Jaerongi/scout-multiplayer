// =====================================================
// SCOUT MULTIPLAYER — SERVER 옵션B 최종 안정본
// (SHOW / SCOUT / SHOW&SCOUT / CANCEL 완전 일치)
// =====================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { getComboType, isStrongerCombo } from "./shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));
app.get("/shared.js", (req, res) =>
  res.sendFile(process.cwd() + "/shared.js")
);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log("SERVER START", PORT));

// =====================================================
// ROOMS
// =====================================================
const rooms = {};

// =====================================================
// DECK
// =====================================================
function createDeck() {
  const deck = [];
  for (let t = 1; t <= 9; t++) {
    for (let b = t + 1; b <= 10; b++) {
      deck.push({ top: t, bottom: b });
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

function deal(n) {
  let deck = shuffle(createDeck());

  if (n === 3)
    deck = deck.filter((c) => c.top !== 10 && c.bottom !== 10);

  if (n === 2 || n === 4)
    while (deck.length > 44) deck.pop();

  const drop = deck.length % n;
  for (let i = 0; i < drop; i++) deck.pop();

  const size = deck.length / n;
  const hands = [];

  for (let i = 0; i < n; i++) {
    let hand = deck.splice(0, size);
    hand = hand.map((c) =>
      Math.random() < 0.5 ? c : { top: c.bottom, bottom: c.top }
    );
    hands.push(hand);
  }
  return hands;
}

// =====================================================
// SOCKET
// =====================================================
io.on("connection", (socket) => {

  // ---------------------------------------------------
  // JOIN ROOM
  // ---------------------------------------------------
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
        lastShowPlayer: null,
        round: 1,
        startIndex: 0,
        totalRounds: 0,
        host: null,
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
        isOnline: true,
        ready: false,
        hand: [],
        score: 0,

        // SHOW&SCOUT 전용 상태
        scoutShowMode: false,
        lastScoutedCard: null,
        lastScoutedInfo: null,  // { originalIndex, side, flip, pos }
      };
      if (isFirst) room.host = permUid;
    } else {
      room.players[permUid].socketId = socket.id;
      room.players[permUid].isOnline = true;
    }

    io.to(roomId).emit("playerListUpdate", room.players);

    const gameStarted = room.turnOrder.length > 0;

    if (gameStarted) {
      const p = room.players[permUid];
      io.to(socket.id).emit("restoreState", {
        hand: p.hand,
        table: room.table,
        score: p.score,
        round: room.round,
        players: room.players,
        turn: room.turnOrder[room.currentTurn],
      });
    }
  });

  // ---------------------------------------------------
  // READY
  // ---------------------------------------------------
  socket.on("playerReady", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (!room.players[permUid].isHost)
      room.players[permUid].ready = !room.players[permUid].ready;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // ---------------------------------------------------
  // START GAME
  // ---------------------------------------------------
  socket.on("startGame", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room || room.host !== permUid) return;

    const readyOK = Object.values(room.players)
      .filter((p) => !p.isHost)
      .every((p) => p.ready);

    if (!readyOK) return;

    room.totalRounds = Object.keys(room.players).length;
    room.round = 1;
    room.startIndex = 0;

    startRound(room);

    io.to(roomId).emit("goGamePage");
  });

  // ---------------------------------------------------
  // SHOW
  // ---------------------------------------------------
  socket.on("show", ({ roomId, permUid, cards }) => {
    const room = rooms[roomId];
    const p = room.players[permUid];
    if (!room || !p) return;

    // SHOW 비교 실패
    if (room.table.length > 0 && !isStrongerCombo(cards, room.table)) {
      if (p.scoutShowMode) {
        io.to(p.socketId).emit("showFailed");
        return;
      }
      return;
    }

    // SHOW 성공
    p.score += room.table.length;

    // 손패에서 제거
    p.hand = p.hand.filter(
      (h) => !cards.some((c) => c.top === h.top && c.bottom === h.bottom)
    );

    // 테이블 덮어쓰기
    room.table = cards;
    room.lastShowPlayer = permUid;

    // SHOW&SCOUT 종료
    p.scoutShowMode = false;
    p.lastScoutedCard = null;
    p.lastScoutedInfo = null;

    io.to(p.socketId).emit("yourHand", p.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    // ⭐ 손패가 0장이면 즉시 라운드 종료
    if (p.hand.length === 0) return endRound(room, permUid);

    nextTurn(room);
  });

  // ---------------------------------------------------
  // SCOUT
  // ---------------------------------------------------
  socket.on("scout", ({ roomId, permUid, side, flip, pos }) => {
    const room = rooms[roomId];
    const p = room.players[permUid];

    if (!room || !p || room.table.length === 0) return;

    // 가져올 카드 위치
    const originalIndex =
      room.table.length === 1
        ? 0
        : side === "left"
        ? 0
        : room.table.length - 1;

    let card =
      room.table.length === 1
        ? room.table.pop()
        : side === "left"
        ? room.table.shift()
        : room.table.pop();

    if (flip) card = { top: card.bottom, bottom: card.top };

    pos = Math.max(0, Math.min(p.hand.length, pos));
    p.hand.splice(pos, 0, card);

    // SHOW&SCOUT 모드 → 턴 유지
    if (p.scoutShowMode) {
      p.lastScoutedCard = card;
      p.lastScoutedInfo = { originalIndex, side, flip, pos };

      io.to(p.socketId).emit("yourHand", p.hand);
      io.to(roomId).emit("tableUpdate", room.table);

      return;
    }

    // 일반 SCOUT → 테이블 낸 사람 점수 +1
    if (room.lastShowPlayer && room.lastShowPlayer !== permUid) {
      room.players[room.lastShowPlayer].score += 1;
    }

    io.to(p.socketId).emit("yourHand", p.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    // ⭐ 손패가 0장이면 즉시 라운드 종료
    if (p.hand.length === 0) return endRound(room, permUid);

    nextTurn(room);
  });

  // ---------------------------------------------------
  // SHOW 실패 → SCOUT 복구
  // ---------------------------------------------------
  socket.on("cancelShowScout", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    const p = room.players[permUid];
    if (!room || !p) return;

    const card = p.lastScoutedCard;
    const info = p.lastScoutedInfo;
    if (!card || !info) return;

    // 손패에서 제거
    p.hand = p.hand.filter(
      (h) => !(h.top === card.top && h.bottom === card.bottom)
    );

    // ⭐ 정확한 원래 위치에 복구
    room.table.splice(info.originalIndex, 0, card);

    p.lastScoutedCard = null;
    p.lastScoutedInfo = null;

    io.to(p.socketId).emit("yourHand", p.hand);
    io.to(roomId).emit("tableUpdate", room.table);

    io.to(p.socketId).emit("cancelShowScoutDone");
  });

  // ---------------------------------------------------
  // SHOW&SCOUT 모드 시작
  // ---------------------------------------------------
  socket.on("startShowScout", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    const p = room.players[permUid];
    if (!room || !p) return;

    p.scoutShowMode = true;
    io.to(p.socketId).emit("enterScoutMode");
  });

  // ---------------------------------------------------
  // DISCONNECT
  // ---------------------------------------------------
  socket.on("disconnect", () => {
    for (const rid in rooms) {
      const room = rooms[rid];
      for (const p of Object.values(room.players)) {
        if (p.socketId === socket.id) {
          p.isOnline = false;
        }
      }
      io.to(rid).emit("playerListUpdate", room.players);
    }
  });
});

// =====================================================
// ROUND START
// =====================================================
function startRound(room) {
  const uids = Object.keys(room.players);
  const hands = deal(uids.length);

  uids.forEach((uid, i) => {
    const p = room.players[uid];
    p.hand = hands[i];
    p.scoutShowMode = false;
    p.lastScoutedCard = null;
    p.lastScoutedInfo = null;
  });

  room.turnOrder = [...uids];
  room.currentTurn = room.startIndex;
  room.table = [];
  room.lastShowPlayer = null;

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    turnOrder: room.turnOrder,
  });

  uids.forEach((uid) => {
    const p = room.players[uid];
    if (p.isOnline) io.to(p.socketId).emit("yourHand", p.hand);
  });

  io.to(room.roomId).emit(
    "turnChange",
    room.turnOrder[room.currentTurn]
  );
}

// =====================================================
// END ROUND
// =====================================================
function endRound(room, winner) {

  // 상대방들 손패 수만큼 -점수
  for (const uid of Object.keys(room.players)) {
    if (uid !== winner) {
      room.players[uid].score -= room.players[uid].hand.length;
    }
  }

  io.to(room.roomId).emit("roundEnd", {
    winner,
    players: room.players,
  });

  // 게임 종료
  if (room.round >= room.totalRounds) {
    let finalWinner = null;
    let max = -999999;

    for (const uid of Object.keys(room.players)) {
      const s = room.players[uid].score;
      if (s > max) {
        max = s;
        finalWinner = uid;
      }
    }

    io.to(room.roomId).emit("gameOver", {
      winner: finalWinner,
      players: room.players,
    });

    return;
  }

  room.round++;
  room.startIndex =
    (room.startIndex + 1) % room.turnOrder.length;

  startRound(room);
}

// =====================================================
// NEXT TURN
// =====================================================
function nextTurn(room) {
  for (let i = 0; i < room.turnOrder.length; i++) {

    room.currentTurn =
      (room.currentTurn + 1) % room.turnOrder.length;

    const uid = room.turnOrder[room.currentTurn];
    const p = room.players[uid];

    if (!p.isOnline) continue;

    // SHOW 마지막 플레이어에게 다시 턴이 오면 라운드 종료
    if (room.lastShowPlayer && uid === room.lastShowPlayer) {
      return endRound(room, room.lastShowPlayer);
    }

    io.to(room.roomId).emit("turnChange", uid);
    return;
  }
}
