// =====================================================
// SCOUT MULTIPLAYER — FINAL SERVER (2025.11 안정판)
// roomId 안전전송 + 라운드 회전 + 게임 종료 + 재접속 복구
// =====================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { getComboType, isStrongerCombo } from "./shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// 정적 파일
app.use(express.static("public"));
app.get("/shared.js", (req, res) => res.sendFile(process.cwd() + "/shared.js"));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log("SERVER START:", PORT));

const rooms = {};


// =====================================================
// 45장 덱
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
// 패 분배
// =====================================================
function deal(playerCount) {
  let deck = shuffle(createDeck());

  if (playerCount === 3)
    deck = deck.filter(c => c.top !== 10 && c.bottom !== 10);

  if (playerCount === 2 || playerCount === 4)
    while (deck.length > 44) deck.pop();

  const drop = deck.length % playerCount;
  for (let i = 0; i < drop; i++) deck.pop();

  const size = deck.length / playerCount;
  const result = [];

  for (let i = 0; i < playerCount; i++) {
    let hand = deck.splice(0, size);

    hand = hand.map(c =>
      Math.random() < 0.5 ? c : { top: c.bottom, bottom: c.top }
    );

    result.push(hand);
  }

  return result;
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
        round: 1,
        host: permUid,
        lastShowPlayer: null,

        firstPlayerIndex: 0,
        totalRounds: 0
      };
    }

    const room = rooms[roomId];
    const isFirst = Object.keys(room.players).length === 0;

    // 새 유저 or 재접속
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
      room.players[permUid].nickname = nickname; // 닉네임 갱신
      room.players[permUid].socketId = socket.id;
      room.players[permUid].isOnline = true;
    }

    // 📡 roomId 포함해서 보내도록 수정
    io.to(roomId).emit("playerListUpdate", {
      roomId,
      players: room.players
    });

    // 이미 게임 중이라면 복구
    const gameStarted = room.turnOrder.length > 0;
    if (gameStarted) {
      const p = room.players[permUid];

      io.to(socket.id).emit("restoreState", {
        roomId,
        players: room.players,
        table: room.table,
        hand: p.hand,
        round: room.round,
        turn: room.turnOrder[room.currentTurn]
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

    io.to(roomId).emit("playerListUpdate", {
      roomId,
      players: room.players
    });
  });

  // ---------------------------------------------------
  // START GAME
  // ---------------------------------------------------
  socket.on("startGame", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.host !== permUid) return;

    const ok = Object.values(room.players)
      .filter(p => !p.isHost)
      .every(p => p.ready === true);

    if (!ok) return;

    room.turnOrder = Object.keys(room.players);
    room.totalRounds = room.turnOrder.length;
    room.firstPlayerIndex = 0;
    room.round = 1;

    startRound(room);

    io.to(roomId).emit("goGamePage", { roomId });
  });

  // ---------------------------------------------------
  // 방향 확정
  // ---------------------------------------------------
  socket.on("confirmFlip", ({ roomId, permUid, flipped }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players[permUid].hand = flipped;
  });

  // ---------------------------------------------------
  // SHOW
  // ---------------------------------------------------
  socket.on("show", ({ roomId, permUid, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[permUid];
    const before = player.hand;

    player.score += room.table.length;

    // remove used cards
    player.hand = before.filter(
      h => !cards.some(c => c.top === h.top && c.bottom === h.bottom)
    );

    room.table = cards;
    room.lastShowPlayer = permUid;

    io.to(player.socketId).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", {
      roomId,
      players: room.players
    });

    nextTurn(room);
  });

  // ---------------------------------------------------
  // SCOUT
  // ---------------------------------------------------
  socket.on("scout", ({ roomId, permUid, side, flip, pos }) => {
    const room = rooms[roomId];
    if (!room || room.table.length === 0) return;

    const player = room.players[permUid];

    let card;
    if (room.table.length === 1) card = room.table.pop();
    else card = (side === "left") ? room.table.shift() : room.table.pop();

    if (flip) card = { top: card.bottom, bottom: card.top };

    pos = Math.max(0, Math.min(player.hand.length, pos));
    player.hand.splice(pos, 0, card);

    // 점수 처리
    if (room.lastShowPlayer && room.lastShowPlayer !== permUid)
      room.players[room.lastShowPlayer].score += 1;

    io.to(player.socketId).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", {
      roomId,
      players: room.players
    });

    nextTurn(room);
  });

  // ---------------------------------------------------
  // disconnect
  // ---------------------------------------------------
  socket.on("disconnect", () => {
    for (const rid in rooms) {
      const room = rooms[rid];
      for (const p of Object.values(room.players)) {
        if (p.socketId === socket.id) p.isOnline = false;
      }

      io.to(rid).emit("playerListUpdate", {
        roomId: rid,
        players: room.players
      });
    }
  });
});


// =====================================================
// ROUND START
// =====================================================
function startRound(room) {
  const uids = room.turnOrder;
  const hands = deal(uids.length);

  uids.forEach((uid, i) => {
    room.players[uid].hand = hands[i];
  });

  room.currentTurn = room.firstPlayerIndex;
  room.table = [];
  room.lastShowPlayer = null;

  io.to(room.roomId).emit("roundStart", {
    roomId: room.roomId,
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[room.currentTurn]
  });

  uids.forEach(uid => {
    const p = room.players[uid];
    if (p.isOnline) io.to(p.socketId).emit("yourHand", p.hand);
  });

  io.to(room.roomId).emit("turnChange", room.turnOrder[room.currentTurn]);
}


// =====================================================
// TURN LOGIC + ROUND END + GAME END
// =====================================================
function nextTurn(room) {

  // 다음 턴 찾기
  for (let i = 0; i < room.turnOrder.length; i++) {

    room.currentTurn =
      (room.currentTurn + 1) % room.turnOrder.length;

    const uid = room.turnOrder[room.currentTurn];
    const p = room.players[uid];

    // 라운드 종료 확인
    if (room.lastShowPlayer && uid === room.lastShowPlayer) {

      const winner = room.lastShowPlayer;

      for (const u of Object.keys(room.players)) {
        if (u !== winner)
          room.players[u].score -= room.players[u].hand.length;
      }

      // 라운드 종료 이벤트
      io.to(room.roomId).emit("roundEnd", {
        roomId: room.roomId,
        winner,
        players: room.players
      });

      // 🔥 다음 라운드
      room.round++;
      room.firstPlayerIndex =
        (room.firstPlayerIndex + 1) % room.turnOrder.length;

      // 게임 종료 조건
      if (room.round > room.totalRounds) {
        io.to(room.roomId).emit("gameOver", {
          roomId: room.roomId,
          players: room.players
        });
        return;
      }

      startRound(room);
      return;
    }

    // 오프라인 넘기기
    if (!p.isOnline) continue;

    io.to(room.roomId).emit("turnChange", uid);
    return;
  }
}
