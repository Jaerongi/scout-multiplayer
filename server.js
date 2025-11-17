// =============================
// SCOUT MULTIPLAYER – server.js
// =============================
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import {
  getComboType,
  isStrongerCombo,
} from "./shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

// ★ public 밖의 shared.js 를 브라우저에서 접근 가능하게!
app.get("/shared.js", (req, res) => {
  res.sendFile(process.cwd() + "/shared.js");
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("SERVER START", PORT);
});

const rooms = {};


// =========================================
// 공식 SCOUT 45장 덱 생성
// =========================================
function createDeck() {
  const deck = [];
  for (let top = 1; top <= 9; top++) {
    for (let bottom = top + 1; bottom <= 10; bottom++) {
      deck.push({ top, bottom });
    }
  }
  return deck;
}

// =========================================
// 셔플
// =========================================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// =========================================
// 인원수에 따라 분배 + 방향 랜덤
// =========================================
function deal(playerCount) {
  let deck = shuffle(createDeck());

  // 3인 → 숫자 10 포함 카드 제거
  if (playerCount === 3) {
    deck = deck.filter(c => c.top !== 10 && c.bottom !== 10);
  }

  // 2인 / 4인 → 44장 되도록 1장 제거
  if (playerCount === 2 || playerCount === 4) {
    while (deck.length > 44) deck.pop();
  }

  // 정확히 나눠떨어지도록 잘라내기
  const remove = deck.length % playerCount;
  for (let i = 0; i < remove; i++) deck.pop();

  const size = deck.length / playerCount;
  const hands = [];

  for (let i = 0; i < playerCount; i++) {
    let hand = deck.splice(0, size);

    // top/bottom 랜덤 뒤집기
    hand = hand.map(c => {
      if (Math.random() < 0.5) return c;
      return { top: c.bottom, bottom: c.top };
    });

    hands.push(hand);
  }

  return hands;
}


// =========================================
// CONNECTION
// =========================================
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  // --------------------------
  // JOIN ROOM
  // --------------------------
  socket.on("joinRoom", ({ roomId, nickname }) => {
    if (!roomId || !nickname) return;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        players: {},
        turnOrder: [],
        currentTurnIndex: 0,
        tableCards: [],
        round: 1,
        host: null,
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
      score: 0,
    };

    if (isFirst) room.host = socket.id;

    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // --------------------------
  // READY
  // --------------------------
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.players[socket.id].isHost) return;

    room.players[socket.id].ready = !room.players[socket.id].ready;
    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // --------------------------
  // START GAME
  // --------------------------
  socket.on("startGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.host !== socket.id) return;

    const allReady = Object.values(room.players)
      .filter(p => !p.isHost)
      .every(p => p.ready);

    if (!allReady) {
      io.to(socket.id).emit("errorMessage", "모든 참가자가 준비 완료되지 않았습니다!");
      return;
    }

    startRound(room);
    io.to(roomId).emit("goGamePage");
  });

  // --------------------------
  // CONFIRM FLIP
  // --------------------------
  socket.on("confirmFlip", ({ roomId, flipped }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.players[socket.id].hand = flipped;
  });

  // --------------------------
  // SHOW (패 제출)
  // --------------------------
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;
    const player = room.players[uid];

    // 기존 테이블 카드 수 만큼 점수 +
    player.score += room.tableCards.length;

    // 패 제거
    player.hand = player.hand.filter(
      h => !cards.some(c => c.top === h.top && c.bottom === h.bottom)
    );

    // 테이블 갱신
    room.tableCards = cards;

    io.to(roomId).emit("tableUpdate", cards);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

  // --------------------------
  // SCOUT
  // --------------------------
  socket.on("scout", ({ roomId, chosen, pos }) => {
    const room = rooms[roomId];
    if (!room) return;

    let take = null;

    if (room.tableCards.length === 1) take = room.tableCards.pop();
    else if (room.tableCards.length >= 2) {
      if (chosen === "left") take = room.tableCards.shift();
      else take = room.tableCards.pop();
    }

    if (!take) return;

    const player = room.players[socket.id];

    if (pos === "front") player.hand.unshift(take);
    else player.hand.push(take);

    io.to(roomId).emit("tableUpdate", room.tableCards);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

  // --------------------------
  // DISCONNECT
  // --------------------------
  socket.on("disconnect", () => {
    for (const r in rooms) {
      const room = rooms[r];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(r).emit("playerListUpdate", room.players);
      }
    }
  });
});


// =========================================
// ROUND START
// =========================================
function startRound(room) {
  const uids = Object.keys(room.players);
  const hands = deal(uids.length);

  uids.forEach((uid, i) => {
    room.players[uid].hand = hands[i];
  });

  room.turnOrder = uids;
  room.currentTurnIndex = 0;
  room.tableCards = [];

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[0],
  });

  uids.forEach(uid => {
    io.to(uid).emit("yourHand", room.players[uid].hand);
  });

  io.to(room.roomId).emit("turnChange", room.turnOrder[0]);
}

function nextTurn(room) {
  room.currentTurnIndex =
    (room.currentTurnIndex + 1) % room.turnOrder.length;

  io.to(room.roomId).emit(
    "turnChange",
    room.turnOrder[room.currentTurnIndex]
  );
}


