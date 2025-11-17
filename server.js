// =====================================================
// SCOUT MULTIPLAYER — NEW SERVER (BUG-FREE FINAL)
// =====================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { getComboType, isStrongerCombo } from "./shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));
app.get("/shared.js", (req, res) => {
  res.sendFile(process.cwd() + "/shared.js");
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log("SERVER START", PORT));

const rooms = {};


// =====================================================
// 덱 생성 (45장)
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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


// =====================================================
// 인원수에 따라 핸드 분배 + 랜덤 방향
// =====================================================
function deal(playerCount) {
  let deck = shuffle(createDeck());

  if (playerCount === 3) {
    deck = deck.filter(c => c.top !== 10 && c.bottom !== 10);
  }
  if (playerCount === 2 || playerCount === 4) {
    while (deck.length > 44) deck.pop();
  }

  const drop = deck.length % playerCount;
  for (let i = 0; i < drop; i++) deck.pop();

  const size = deck.length / playerCount;
  const hands = [];

  for (let i = 0; i < playerCount; i++) {
    let hand = deck.splice(0, size);
    hand = hand.map(c => (Math.random() < 0.5 ? c : { top: c.bottom, bottom: c.top }));
    hands.push(hand);
  }
  return hands;
}


// =====================================================
// SOCKET CONNECTION
// =====================================================
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  // 방 입장
  socket.on("joinRoom", ({ roomId, nickname }) => {
    if (!roomId || !nickname) return;

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

    room.players[socket.id] = {
      uid: socket.id,
      nickname,
      isHost: isFirst,
      ready: false,
      hand: [],
      score: 0
    };

    if (isFirst) room.host = socket.id;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // READY
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.players[socket.id].isHost) return;

    room.players[socket.id].ready = !room.players[socket.id].ready;
    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // 게임 시작
  socket.on("startGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.host !== socket.id) return;

    const ok = Object.values(room.players)
      .filter(p => !p.isHost)
      .every(p => p.ready);

    if (!ok) return;

    startRound(room);
    io.to(roomId).emit("goGamePage");
  });

  // 방향 확정
  socket.on("confirmFlip", ({ roomId, flipped }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.players[socket.id].hand = flipped;
  });


  // =====================================================
  // SHOW
  // =====================================================
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;
    const player = room.players[uid];

    // --- 점수 계산: 기존 테이블 카드 수 만큼 + ---
    player.score += room.table.length;

    // --- 패 제거 ---
    player.hand = player.hand.filter(
      h => !cards.some(c => c.top === h.top && c.bottom === h.bottom)
    );

    // --- 테이블 업데이트 ---
    room.table = cards;

    // 마지막 SHOW player 갱신
    room.lastShowPlayer = uid;

    io.to(uid).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });


  // =====================================================
  // SCOUT
  // =====================================================
  socket.on("scout", ({ roomId, side, flip, pos }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;
    const player = room.players[uid];

    if (room.table.length === 0) return;

    // ------------ 1) 가져올 카드 선택 ------------
    let card;
    if (room.table.length === 1) {
      card = room.table.pop();
    } else {
      card = side === "left" ? room.table.shift() : room.table.pop();
    }

    // ------------ 2) flip 적용 ------------
    if (flip) card = { top: card.bottom, bottom: card.top };

    // ------------ 3) 삽입 위치 ------------
    pos = Math.max(0, Math.min(pos, player.hand.length));
    player.hand.splice(pos, 0, card);

    // ------------ 4) 점수 계산: 스카우트는 제출자 +1점 ------------
    const submitter = room.lastShowPlayer;
    if (submitter && submitter !== uid) {
      room.players[submitter].score += 1;
    }

    io.to(uid).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });


  // 연결 종료
  socket.on("disconnect", () => {
    for (const rid in rooms) {
      const room = rooms[rid];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(rid).emit("playerListUpdate", room.players);
      }
    }
  });
});


// =====================================================
// 라운드 시작
// =====================================================
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
    io.to(uid).emit("yourHand", room.players[uid].hand);
  });

  io.to(room.roomId).emit("turnChange", room.turnOrder[0]);
}


// =====================================================
// 턴 진행 로직 + 라운드 종료
// =====================================================
function nextTurn(room) {
  room.currentTurn =
    (room.currentTurn + 1) % room.turnOrder.length;

  const cur = room.turnOrder[room.currentTurn];

  // ------------------------------------------------------------------
  // ★ 모두 SCOUT만 해서 → 마지막 SHOW player에게 턴이 돌아오면 라운드 종료
  // ------------------------------------------------------------------
  if (room.lastShowPlayer && cur === room.lastShowPlayer) {

    const winner = room.lastShowPlayer;

    // 점수 계산
    for (const uid of Object.keys(room.players)) {
      const p = room.players[uid];
      if (uid === winner) continue;
      p.score -= p.hand.length; // 손패 × -1
    }

    io.to(room.roomId).emit("roundEnd", {
      winner,
      players: room.players
    });

    room.round++;
    startRound(room);
    return;
  }

  io.to(room.roomId).emit("turnChange", cur);
}
