// =====================================================
// SCOUT MULTIPLAYER — SERVER (백업본 + SHOW&SCOUT 확장)
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

const rooms = {};

// 덱 관련은 백업본 그대로
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
  const res = [];
  for (let i = 0; i < n; i++) {
    let hand = deck.splice(0, size);
    hand = hand.map((c) =>
      Math.random() < 0.5 ? c : { top: c.bottom, bottom: c.top }
    );
    res.push(hand);
  }
  return res;
}

// =====================================================
// SOCKET.IO
// =====================================================
io.on("connection", (socket) => {

  // JOIN ROOM (백업본 그대로)
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
        lastScoutedInfo: null,
      };
      if (isFirst) room.host = permUid;
    } else {
      room.players[permUid].socketId = socket.id;
      room.players[permUid].isOnline = true;
    }

    // ⭐ 백업본 원래 구조 유지 (players만 전송)
    io.to(roomId).emit("playerListUpdate", room.players);

    const gameStarted = room.turnOrder.length > 0;
    const p = room.players[permUid];

    if (gameStarted) {
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

  // READY (원본)
  socket.on("playerReady", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (!room.players[permUid].isHost)
      room.players[permUid].ready = !room.players[permUid].ready;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // START GAME (원본)
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

  // ============================
  // SHOW (기존 유지 + SHOW&SCOUT 확장)
  // ============================
  socket.on("show", ({ roomId, permUid, cards }) => {
    const room = rooms[roomId];
    const p = room.players[permUid];

    // 비교 실패
    if (room.table.length > 0 && !isStrongerCombo(cards, room.table)) {

      // ⭐ SHOW&SCOUT 상태라면 → 클라이언트에 실패 알림
      if (p.scoutShowMode) {
        io.to(p.socketId).emit("showFailed");
        return;
      }

      // 일반 SHOW는 실패 무시
      return;
    }

    // 성공 → 점수 추가
    p.score += room.table.length;

    // 손패 삭제
    p.hand = p.hand.filter(
      (h) => !cards.some((c) => c.top === h.top && c.bottom === h.bottom)
    );

    // 테이블 갱신
    room.table = cards;
    room.lastShowPlayer = permUid;

    // SHOW&SCOUT 종료
    if (p.scoutShowMode) {
      p.scoutShowMode = false;
      p.lastScoutedCard = null;
      p.lastScoutedInfo = null;
    }

    io.to(p.socketId).emit("yourHand", p.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

  // ============================
  // SCOUT (기존 유지 + SHOW&SCOUT 확장)
  // ============================
  socket.on("scout", ({ roomId, permUid, side, flip, pos }) => {
    const room = rooms[roomId];
    const p = room.players[permUid];
    if (!room || !p || room.table.length === 0) return;

    // 카드 가져오기
    let card =
      room.table.length === 1
        ? room.table.pop()
        : side === "left"
        ? room.table.shift()
        : room.table.pop();

    if (flip)
      card = { top: card.bottom, bottom: card.top };

    pos = Math.max(0, Math.min(p.hand.length, pos));
    p.hand.splice(pos, 0, card);

    // ⭐ SHOW&SCOUT → 턴 유지
    if (p.scoutShowMode) {
      p.lastScoutedCard = card;
      p.lastScoutedInfo = { side, flip, pos };

      io.to(p.socketId).emit("yourHand", p.hand);
      io.to(roomId).emit("tableUpdate", room.table);
      return;
    }

    // ⭐ 일반 SCOUT → lastShowPlayer에게 +1점
    if (
      room.lastShowPlayer &&
      room.lastShowPlayer !== permUid
    )
      room.players[room.lastShowPlayer].score += 1;

    io.to(p.socketId).emit("yourHand", p.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

  // ============================
  // SHOW 실패 → 취소 처리
  // ============================
  socket.on("cancelShowScout", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    const p = room.players[permUid];

    const card = p.lastScoutedCard;
    const info = p.lastScoutedInfo;
    if (!card || !info) return;

    // 손패에서 삭제
    p.hand = p.hand.filter(
      (h) => !(h.top === card.top && h.bottom === card.bottom)
    );

    // 테이블 복원
    if (info.side === "left") room.table.unshift(card);
    else room.table.push(card);

    p.lastScoutedCard = null;
    p.lastScoutedInfo = null;

    io.to(p.socketId).emit("yourHand", p.hand);
    io.to(roomId).emit("tableUpdate", room.table);

    io.to(p.socketId).emit("cancelShowScoutDone");
  });

  // SHOW&SCOUT 시작
  socket.on("startShowScout", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    const p = room.players[permUid];
    p.scoutShowMode = true;

    io.to(p.socketId).emit("enterScoutMode");
  });

  // disconnect
  socket.on("disconnect", () => {
    for (const rid in rooms) {
      const room = rooms[rid];
      for (const p of Object.values(room.players))
        if (p.socketId === socket.id) p.isOnline = false;

      io.to(rid).emit("playerListUpdate", room.players);
    }
  });
});

// ==========================
// ROUND START (백업본 그대로)
// ==========================
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

  io.to(room.roomId).emit("turnChange", room.turnOrder[room.currentTurn]);
}

// ==========================
// NEXT TURN (백업본 그대로)
// ==========================
function nextTurn(room) {
  for (let i = 0; i < room.turnOrder.length; i++) {
    room.current
