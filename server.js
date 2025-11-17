// =============================
// SCOUT MULTIPLAYER – server.js (FINAL FIXED VERSION)
// =============================
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import {
  getComboType,
  isStrongerCombo,
} from "./shared.js";

// -----------------------------
// EXPRESS + STATIC 설정
// -----------------------------
const app = express();

// Railway에서는 JS MIME이 깨져서 모듈이 안 로드됨 → 반드시 강제 지정 필요
app.use(express.static("public", {
  setHeaders: (res, path) => {
    if (path.endsWith(".js")) {
      res.set("Content-Type", "application/javascript");
    }
    if (path.endsWith(".css")) {
      res.set("Content-Type", "text/css");
    }
  }
}));

// public 밖의 shared.js를 서빙
app.get("/shared.js", (req, res) => {
  res.type("application/javascript");
  res.sendFile(process.cwd() + "/shared.js");
});

// -----------------------------
// SERVER + SOCKET.IO
// -----------------------------
const httpServer = createServer(app);
const io = new Server(httpServer);

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

  if (playerCount === 3) {
    deck = deck.filter(c => c.top !== 10 && c.bottom !== 10);
  }

  if (playerCount === 2 || playerCount === 4) {
    while (deck.length > 44) deck.pop();
  }

  const remove = deck.length % playerCount;
  for (let i = 0; i < remove; i++) deck.pop();

  const size = deck.length / playerCount;
  const hands = [];

  for (let i = 0; i < playerCount; i++) {
    let hand = deck.splice(0, size);

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

  // JOIN ROOM
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
        lastShowPlayer: null,
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

  // READY
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.players[socket.id].isHost) return;

    room.players[socket.id].ready = !room.players[socket.id].ready;
    io.to(roomId).emit("playerListUpdate", room.players);
  });

  // START GAME
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

  // CONFIRM FLIP
  socket.on("confirmFlip", ({ roomId, flipped }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.players[socket.id].hand = flipped;
  });

  // SHOW
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;
    const player = room.players[uid];

    room.lastShowPlayer = uid;

    player.score += room.tableCards.length;

    player.hand = player.hand.filter(
      h => !cards.some(c => c.top === h.top && c.bottom === h.bottom)
    );

    room.tableCards = cards;

    io.to(uid).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.tableCards);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

  // SCOUT
  socket.on("scout", ({ roomId, side, flip, pos }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;
    const player = room.players[uid];

    let take = null;
    if (room.tableCards.length === 1) {
      take = room.tableCards.pop();
    } else {
      take = (side === "left")
        ? room.tableCards.shift()
        : room.tableCards.pop();
    }

    if (!take) return;

    if (flip) take = { top: take.bottom, bottom: take.top };

    if (pos < 0) pos = 0;
    if (pos > player.hand.length) pos = player.hand.length;

    player.hand.splice(pos, 0, take);

    if (room.lastShowPlayer) {
      room.players[room.lastShowPlayer].score += 1;
    }

    io.to(uid).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.tableCards);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });

  // DISCONNECT
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
  room.lastShowPlayer = null;

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



// =========================================
// TURN CHANGE + 승리 조건 체크
// =========================================
function nextTurn(room) {
  room.currentTurnIndex =
    (room.currentTurnIndex + 1) % room.turnOrder.length;

  const currentPlayer = room.turnOrder[room.currentTurnIndex];

  if (room.lastShowPlayer && currentPlayer === room.lastShowPlayer) {

    const winner = room.lastShowPlayer;

    for (const uid of Object.keys(room.players)) {
      const player = room.players[uid];

      if (uid === winner) {
        player.score += 0;
      } else {
        player.score -= player.hand.length;
      }
    }

    io.to(room.roomId).emit("roundEnd", {
      winner,
      players: room.players
    });

    room.round++;
    startRound(room);
    return;
  }

  io.to(room.roomId).emit("turnChange", currentPlayer);
}
