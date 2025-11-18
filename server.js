// =====================================================
// SCOUT MULTIPLAYER — SERVER + 회원가입/로그인 + 관리자 관리 시스템
// =====================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { getComboType, isStrongerCombo } from "./public/shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const __dirname = path.resolve();

// -----------------------------------------
// JSON DB 로드/저장 함수
// -----------------------------------------

function loadUserDB() {
  try {
    const data = fs.readFileSync("./userDB.json", "utf8");
    return JSON.parse(data);
  } catch (e) {
    return { users: {} };
  }
}

function saveUserDB(db) {
  fs.writeFileSync("./userDB.json", JSON.stringify(db, null, 2));
}

function loadAdminDB() {
  try {
    const data = fs.readFileSync("./adminDB.json", "utf8");
    return JSON.parse(data);
  } catch (e) {
    return { admin: { id: "관리자", pw: "1021" } };
  }
}

// shortUUID 생성
function shortUUID() {
  return Math.random().toString(36).substring(2, 6);
}

// -----------------------------------------
// 미들웨어
// -----------------------------------------

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


// =====================================================
// 회원 시스템 API
// =====================================================

// 로그인 + 회원가입
app.post("/api/login", (req, res) => {
  const nickname = req.body.nickname.trim();
  if (!nickname) return res.json({ ok: false, msg: "닉네임 필요" });

  const db = loadUserDB();

  // 기존 유저 찾기
  const foundKey = Object.keys(db.users).find(
    (uid) => db.users[uid].nickname === nickname
  );

  if (foundKey) {
    return res.json({ ok: true, userId: foundKey });
  }

  // 새 유저 생성
  const tag = shortUUID();
  const userId = `${nickname}-${tag}`;

  db.users[userId] = { nickname, tag };
  saveUserDB(db);

  return res.json({ ok: true, userId });
});


// =====================================================
// 관리자 API
// =====================================================

// 관리자 로그인
app.post("/api/admin/login", (req, res) => {
  const { id, pw } = req.body;
  const db = loadAdminDB();

  if (db.admin.id === id && db.admin.pw === pw) {
    return res.json({ ok: true });
  }
  return res.json({ ok: false });
});

// 전체 유저 목록
app.get("/api/admin/users", (req, res) => {
  const db = loadUserDB();
  const list = Object.keys(db.users).map((uid) => db.users[uid].nickname);
  res.json(list);
});

// 유저 삭제
app.post("/api/admin/deleteUser", (req, res) => {
  const { nickname } = req.body;

  const db = loadUserDB();
  const key = Object.keys(db.users).find(
    (uid) => db.users[uid].nickname === nickname
  );

  if (!key) return res.json({ ok: false, msg: "존재하지 않는 사용자" });

  delete db.users[key];
  saveUserDB(db);

  res.json({ ok: true });
});


// =====================================================
// 관리자 페이지 라우팅
// =====================================================
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});


// =====================================================
// SCOUT 게임 서버 기능
// =====================================================

// 루트 데이터
const rooms = {};

// 덱 생성
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


// =====================================================
// SOCKET.IO
// =====================================================
io.on("connection", (socket) => {


  // joinRoom
  socket.on("joinRoom", ({ roomId, userId }) => {
    if (!roomId || !userId) return;

    const db = loadUserDB();
    if (!db.users[userId]) return; // 사용자 없음

    const nickname = db.users[userId].nickname;

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
        startIndex: 0,
        totalRounds: 0,
      };
    }

    const room = rooms[roomId];
    const isFirst = Object.keys(room.players).length === 0;

    if (!room.players[userId]) {
      room.players[userId] = {
        uid: userId,
        nickname,
        socketId: socket.id,
        isHost: isFirst,
        ready: false,
        hand: [],
        score: 0,
        isOnline: true,
      };

      if (isFirst) room.host = userId;

    } else {
      room.players[userId].socketId = socket.id;
      room.players[userId].isOnline = true;
    }

    io.to(roomId).emit("playerListUpdate", room.players);

    const gameStarted = room.turnOrder.length > 0;
    if (gameStarted) {
      const p = room.players[userId];
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
  socket.on("playerReady", ({ roomId, userId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (!room.players[userId].isHost)
      room.players[userId].ready = !room.players[userId].ready;

    io.to(roomId).emit("playerListUpdate", room.players);
  });


  // START GAME
  socket.on("startGame", ({ roomId, userId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.host !== userId) return;

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
  socket.on("show", ({ roomId, userId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[userId];

    player.score += room.table.length;

    player.hand = player.hand.filter(
      (h) => !cards.some((c) => c.top === h.top && c.bottom === h.bottom)
    );

    room.table = cards;
    room.lastShowPlayer = userId;

    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);
    io.to(player.socketId).emit("yourHand", player.hand);

    nextTurn(room);
  });


  // SCOUT
  socket.on("scout", ({ roomId, userId, side, flip, pos }) => {
    const room = rooms[roomId];
    if (!room || room.table.length === 0) return;

    const player = room.players[userId];

    let card = null;
    if (room.table.length === 1) card = room.table.pop();
    else card = side === "left" ? room.table.shift() : room.table.pop();

    if (flip) card = { top: card.bottom, bottom: card.top };

    pos = Math.max(0, Math.min(player.hand.length, pos));
    player.hand.splice(pos, 0, card);

    if (room.lastShowPlayer && room.lastShowPlayer !== userId) {
      room.players[room.lastShowPlayer].score += 1;
    }

    io.to(player.socketId).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });


  // 강퇴
  socket.on("kickPlayer", ({ roomId, targetUid, userId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.host !== userId) return;

    const target = room.players[targetUid];
    if (!target) return;

    io.to(target.socketId).emit("kicked");
    delete room.players[targetUid];

    io.to(roomId).emit("playerListUpdate", room.players);
  });



  // DISCONNECT
  socket.on("disconnect", () => {

    for (const rid in rooms) {
      const room = rooms[rid];

      for (const uid of Object.keys(room.players)) {
        const p = room.players[uid];

        if (p.socketId === socket.id) {
          p.isOnline = false;

          // 방장이 나가면 방 폭파
          if (room.host === uid) {
            io.to(rid).emit("roomClosed");
            delete rooms[rid];
            return;
          }
        }
      }

      io.to(rid).emit("playerListUpdate", room.players);
    }

  });

});


// =====================================================
// GAME FUNCTIONS
// =====================================================

function startRound(room) {
  const uids = Object.keys(room.players);
  const hands = deal(uids.length);

  uids.forEach((uid, i) => {
    room.players[uid].hand = hands[i];
  });

  room.turnOrder = [...uids];
  room.currentTurn = room.startIndex;
  room.table = [];
  room.lastShowPlayer = null;

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

function nextTurn(room) {
  for (let i = 0; i < room.turnOrder.length; i++) {

    room.currentTurn = (room.currentTurn + 1) % room.turnOrder.length;
    const uid = room.turnOrder[room.currentTurn];
    const p = room.players[uid];

    if (!p.isOnline) continue;

    // 라운드 종료 조건
    if (room.lastShowPlayer && uid === room.lastShowPlayer) {
      const winner = room.lastShowPlayer;

      for (const u of Object.keys(room.players)) {
        if (u !== winner)
          room.players[u].score -= room.players[u].hand.length;
      }

      io.to(room.roomId).emit("roundEnd", {
        winner,
        players: room.players,
      });

      if (room.round >= room.totalRounds) {
        let finalWinner = null;
        let max = -999999;

        for (const uid of Object.keys(room.players)) {
          if (room.players[uid].score > max) {
            max = room.players[uid].score;
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
      room.startIndex = (room.startIndex + 1) % room.turnOrder.length;

      startRound(room);
      return;
    }

    io.to(room.roomId).emit("turnChange", uid);
    return;
  }
}


httpServer.listen(3000, () => console.log("SERVER STARTED 3000"));
