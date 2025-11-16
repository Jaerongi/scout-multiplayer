// =============================
// SCOUT MULTIPLAYER – SERVER FINAL
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
  console.log("SCOUT SERVER STARTED:", PORT);
});

// =============================
// 방 데이터
// =============================
const rooms = {};

// =============================
// 카드 생성 (44장)
// =============================
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

// 인원수별 배분 규칙
function dealForPlayers(n) {
  let deck = shuffle(createDeck());
  let handSize;

  if (n === 3) {
    deck = deck.filter(c => c.top !== 10 && c.bottom !== 10);
    handSize = 12;
  } else if (n >= 2 && n <= 4) {
    const remainder = deck.length % n;
    deck.splice(0, remainder);
    handSize = deck.length / n;
  } else {
    handSize = Math.floor(deck.length / n);
  }

  const hands = [];
  for (let i = 0; i < n; i++) {
    hands.push(deck.splice(0, handSize));
  }

  return { hands, deck };
}

// =============================
// SOCKET IO
// =============================
io.on("connection", (socket) => {
  console.log("CONNECT:", socket.id);

  // 방 입장
  socket.on("joinRoom", ({ roomId, nickname }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        round: 1,
        players: {},
        tableCards: [],
        turnOrder: [],
        currentTurnIndex: 0
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
      coins: 0,
      score: 0,
      flipReady: false
    };

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // 준비
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[socket.id].ready = !room.players[socket.id].ready;
    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // 게임 시작
  socket.on("forceStartGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    io.to(roomId).emit("goGame");

    setTimeout(() => startRound(room), 500);
  });

  // 패 방향 확정
  socket.on("confirmFlip", ({ roomId, flippedOrder }) => {
    const room = rooms[roomId];
    if (!room) return;

    const p = room.players[socket.id];
    p.hand = flippedOrder;
    p.flipReady = true;
  });

// ------------------------------
// SHOW (패 내기)
// ------------------------------
socket.on("show", ({ roomId, cards }) => {
  const room = rooms[roomId];
  if (!room) return;
  const uid = socket.id;

  const player = room.players[uid];
  if (!player) return;

  const previousCount = room.tableCards.length;

  // 테이블 갱신
  room.tableCards = cards;

  // 패 제거
  player.hand = player.hand.filter(
    (c) => !cards.some((cc) => cc.top === c.top && cc.bottom === c.bottom)
  );
  player.handCount = player.hand.length;

  // 점수 +
  player.score += previousCount;

  // 전체 갱신
  io.to(roomId).emit("tableUpdate", room.tableCards);
  io.to(roomId).emit("playerListUpdate", room.players);
  updateHandCounts(room);

  // 🔥 먼저 내 패 다시 보내기
  io.to(uid).emit("yourHand", player.hand);

  // 🔥 이제 턴 넘기기 (내 패가 먼저 갱신된 후)
  nextTurn(room);
});


  // SCOUT (양끝 선택)
  socket.on("scout", ({ roomId, side }) => {
    const room = rooms[roomId];
    if (!room) return;
    const p = room.players[socket.id];

    if (room.tableCards.length === 0) return;

    let picked;

    if (side === "left") picked = room.tableCards.shift();
    else picked = room.tableCards.pop();

    p.hand.push(picked);

    io.to(roomId).emit("tableUpdate", room.tableCards);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

  socket.on("disconnect", () => {
    Object.values(rooms).forEach(room => {
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(room.roomId).emit("playerListUpdate", room.players);
      }
    });
  });
});

// =============================
// ROUND START
// =============================
function startRound(room) {
  const uids = Object.keys(room.players);
  const n = uids.length;

  const { hands } = dealForPlayers(n);

  room.tableCards = [];

  uids.forEach((uid, i) => {
    const p = room.players[uid];
    p.hand = hands[i];
    p.flipReady = false;
  });

  room.turnOrder = uids.sort();   // 모든 유저에게 동일한 순서 강제!
  room.currentTurnIndex = 0;

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: uids[0]
  });

  // 각자 자기 패 전송
  uids.forEach(uid => {
    io.to(uid).emit("yourHand", room.players[uid].hand);
  });
}

function nextTurn(room) {
  room.currentTurnIndex =
    (room.currentTurnIndex + 1) % room.turnOrder.length;
  const nextUid = room.turnOrder[room.currentTurnIndex];

  io.to(room.roomId).emit("turnChange", nextUid);
}


