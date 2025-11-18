// =====================================================
// SCOUT MULTIPLAYER — SERVER FINAL
// (라운드 순환 / 승자 / 최종 우승 / 재경기 / 점수 정상화 / 복구 지원)
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

// =====================================
// 방 데이터 구조
// =====================================
const rooms = {};

// =====================================
// 덱 생성
// =====================================
function createDeck() {
  const deck = [];
  for (let t = 1; t <= 9; t++) {
    for (let b = t + 1; b <= 10; b++) {
      deck.push({ top: t, bottom: b });
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

  if (playerCount === 3)
    deck = deck.filter((c) => c.top !== 10 && c.bottom !== 10);

  if (playerCount === 2 || playerCount === 4)
    while (deck.length > 44) deck.pop();

  const drop = deck.length % playerCount;
  for (let i = 0; i < drop; i++) deck.pop();

  const size = deck.length / playerCount;
  const res = [];

  for (let i = 0; i < playerCount; i++) {
    let hand = deck.splice(0, size);
    hand = hand.map((c) =>
      Math.random() < 0.5 ? c : { top: c.bottom, bottom: c.top }
    );
    res.push(hand);
  }

  return res;
}

// =====================================
// SOCKET.IO
// =====================================
io.on("connection", (socket) => {
  // JOIN ROOM
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
        lastShowPlayer: null,

        // 라운드 제어
        startIndex: 0,
        totalRounds: 0,
      };
    }

    const room = rooms[roomId];
    const isFirst = Object.keys(room.players).length === 0;

    // 신규 또는 복구
    if (!room.players[permUid]) {
      room.players[permUid] = {
        uid: permUid,
        nickname,
        socketId: socket.id,
        isHost: isFirst,
        ready: false,
        hand: [],
        score: 0,
        isOnline: true,
      };
      if (isFirst) room.host = permUid;
    } else {
      room.players[permUid].socketId = socket.id;
      room.players[permUid].isOnline = true;
    }

    io.to(roomId).emit("playerListUpdate", room.players);

    // 복구
    const gameStarted = room.turnOrder.length > 0;
    const p = room.players[permUid];

    if (gameStarted) {
      io.to(socket.id).emit("restoreState", {
        hand: p.hand,
        score: p.score,
        table: room.table,
        round: room.round,
        players: room.players,
        turn: room.turnOrder[room.currentTurn],
      });
    }
  });

  // READY
  socket.on("playerReady", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (!room.players[permUid].isHost)
      room.players[permUid].ready = !room.players[permUid].ready;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // START GAME
  socket.on("startGame", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.host !== permUid) return;

    const readyOK = Object.values(room.players)
      .filter((p) => !p.isHost)
      .every((p) => p.ready);
    if (!readyOK) return;

    room.totalRounds = Object.keys(room.players).length;
    room.round = 1;
    room.startIndex = 0;

    // 점수 초기화
    for (const uid of Object.keys(room.players)) {
      room.players[uid].score = 0;
    }

    startRound(room);
    io.to(roomId).emit("goGamePage");
  });

  // SHOW
  socket.on("show", ({ roomId, permUid, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[permUid];

    // SHOW 점수 = 테이블에 있던 카드 수
    player.score += room.table.length;

    // 패에서 제거
    player.hand = player.hand.filter(
      (h) => !cards.some((c) => c.top === h.top && c.bottom === h.bottom)
    );

    // 테이블 갱신
    room.table = cards;

    // 마지막 SHOW한 사람 기록
    room.lastShowPlayer = permUid;

    io.to(room.roomId).emit("tableUpdate", room.table);
    io.to(room.roomId).emit("playerListUpdate", room.players);
    io.to(player.socketId).emit("yourHand", player.hand);

    nextTurn(room);
  });

  // SCOUT
  socket.on("scout", ({ roomId, permUid, side, flip, pos }) => {
    const room = rooms[roomId];
    if (!room || room.table.length === 0) return;

    const player = room.players[permUid];

    // 꺼내기
    let card = null;
    if (room.table.length === 1) card = room.table.pop();
    else card = side === "left" ? room.table.shift() : room.table.pop();

    // 뒤집기
    if (flip) card = { top: card.bottom, bottom: card.top };

    // 삽입
    pos = Math.max(0, Math.min(player.hand.length, pos));
    player.hand.splice(pos, 0, card);

    // SCOUT 점수 지급 조건
    if (
      room.lastShowPlayer &&
      room.lastShowPlayer !== permUid
    ) {
      room.players[room.lastShowPlayer].score += 1;
    }

    io.to(player.socketId).emit("yourHand", player.hand);
    io.to(room.roomId).emit("tableUpdate", room.table);
    io.to(room.roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

  // DISCONNECT
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

// =====================================
// 라운드 시작
// =====================================
function startRound(room) {
  const uids = Object.keys(room.players);
  const hands = deal(uids.length);

  uids.forEach((uid, i) => {
    room.players[uid].hand = hands[i];
  });

  room.turnOrder = [...uids];

  room.currentTurn = room.startIndex;

  room.table = [];
  room.lastShowPlayer = null; // ★ 중요: 초기화

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[room.currentTurn],
  });

  uids.forEach((uid) => {
    const p = room.players[uid];
    if (p.isOnline) io.to(p.socketId).emit("yourHand", p.hand);
  });

  io.to(room.roomId).emit("turnChange", room.turnOrder[room.currentTurn]);
}

// =====================================
// 턴 진행
// =====================================
function nextTurn(room) {
  for (let i = 0; i < room.turnOrder.length; i++) {
    room.currentTurn = (room.currentTurn + 1) % room.turnOrder.length;

    const uid = room.turnOrder[room.currentTurn];
    const p = room.players[uid];

    if (!p.isOnline) continue;

    // 라운드 종료 조건
    if (room.lastShowPlayer && uid === room.lastShowPlayer) {
      const winner = room.lastShowPlayer;

      // 페널티(패 남은 수만큼 점수 차감)
      for (const u of Object.keys(room.players)) {
        if (u !== winner)
          room.players[u].score -= room.players[u].hand.length;
      }

      // 라운드 승자 UI
      io.to(room.roomId).emit("roundEnd", {
        winner,
        players: room.players,
      });

      // 마지막 라운드 → 최종 우승자 발표
      if (room.round >= room.totalRounds) {
        let finalWinner = null;
        let maxScore = -999999;

        for (const uid of Object.keys(room.players)) {
          if (room.players[uid].score > maxScore) {
            maxScore = room.players[uid].score;
            finalWinner = uid;
          }
        }

        io.to(room.roomId).emit("gameOver", {
          winner: finalWinner,
          players: room.players,
        });

        return;
      }

      // 다음 라운드로 진행
      room.round++;
      room.startIndex = (room.startIndex + 1) % room.turnOrder.length;

      startRound(room);
      return;
    }

    io.to(room.roomId).emit("turnChange", uid);
    return;
  }
}
