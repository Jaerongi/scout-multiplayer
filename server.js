// =====================================================
// SCOUT MULTIPLAYER — SERVER FINAL (NO SHARED IMPORT)
// 회원가입 / 로그인 / 관리자 / 방 / 점수 / 강퇴 / 폭파
// =====================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const __dirname = path.resolve();

// ----------------------------
// JSON DB Util
// ----------------------------
function loadUserDB() {
  try {
    return JSON.parse(fs.readFileSync("./userDB.json", "utf8"));
  } catch {
    return { users: {} };
  }
}

function saveUserDB(db) {
  fs.writeFileSync("./userDB.json", JSON.stringify(db, null, 2));
}

function loadAdminDB() {
  try {
    return JSON.parse(fs.readFileSync("./adminDB.json", "utf8"));
  } catch {
    return { admin: { id: "관리자", pw: "1021" } };
  }
}

function shortUUID() {
  return Math.random().toString(36).substring(2, 6);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


// =====================================================
// 회원/로그인 API
// =====================================================
app.post("/api/login", (req, res) => {
  const nickname = req.body.nickname.trim();
  if (!nickname) return res.json({ ok: false });

  const db = loadUserDB();

  const exist = Object.keys(db.users).find(
    uid => db.users[uid].nickname === nickname
  );

  if (exist) return res.json({ ok: true, userId: exist });

  const tag = shortUUID();
  const userId = `${nickname}-${tag}`;

  db.users[userId] = { nickname, tag };
  saveUserDB(db);

  res.json({ ok: true, userId });
});


// =====================================================
// 관리자 API
// =====================================================
app.post("/api/admin/login", (req,res)=>{
  const { id, pw } = req.body;
  const admin = loadAdminDB().admin;

  if (admin.id === id && admin.pw === pw)
    return res.json({ ok:true });

  res.json({ ok:false });
});

app.get("/api/admin/users", (req,res)=>{
  const db = loadUserDB();
  res.json(
    Object.keys(db.users).map(k => db.users[k].nickname)
  );
});

app.post("/api/admin/deleteUser", (req,res)=>{
  const { nickname } = req.body;

  const db = loadUserDB();
  const key = Object.keys(db.users).find(
    uid => db.users[uid].nickname === nickname
  );

  if (!key) return res.json({ ok:false });

  delete db.users[key];
  saveUserDB(db);

  res.json({ ok:true });
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});


// =====================================================
// 게임 서버
// =====================================================

const rooms = {};

function createDeck() {
  const deck = [];
  for (let t=1; t<=9; t++) {
    for (let b=t+1; b<=10; b++) {
      deck.push({ top:t, bottom:b });
    }
  }
  return deck;
}

function shuffle(a) {
  for (let i=a.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(playerCount) {
  let deck = shuffle(createDeck());

  if (playerCount === 3)
    deck = deck.filter(c => c.top !== 10 && c.bottom !== 10);

  if (playerCount === 2 || playerCount === 4)
    while (deck.length > 44) deck.pop();

  const drop = deck.length % playerCount;
  for (let i=0; i<drop; i++) deck.pop();

  const len = deck.length / playerCount;
  const result = [];

  for (let i=0; i<playerCount; i++) {
    let hand = deck.splice(0,len);
    hand = hand.map(c => Math.random()<0.5 ? c : { top:c.bottom, bottom:c.top });
    result.push(hand);
  }
  return result;
}


// =====================================================
// SOCKET
// =====================================================
io.on("connection", socket => {

  socket.on("joinRoom", ({ roomId, userId }) => {
    if (!roomId || !userId) return;

    const db = loadUserDB();
    if (!db.users[userId]) return; // 계정 없음

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
    const first = Object.keys(room.players).length === 0;

    if (!room.players[userId]) {
      room.players[userId] = {
        uid: userId,
        nickname,
        socketId: socket.id,
        isHost: first,
        ready: false,
        hand: [],
        score: 0,
        isOnline: true
      };
      if (first) room.host = userId;
    } else {
      room.players[userId].socketId = socket.id;
      room.players[userId].isOnline = true;
    }

    io.to(roomId).emit("playerListUpdate", room.players);

    if (room.turnOrder.length > 0) {
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
  socket.on("playerReady", ({roomId, userId})=>{
    const room = rooms[roomId];
    if (!room) return;

    if (!room.players[userId].isHost)
      room.players[userId].ready = !room.players[userId].ready;

    io.to(roomId).emit("playerListUpdate", room.players);
  });


  // START
  socket.on("startGame", ({roomId, userId})=>{
    const room = rooms[roomId];
    if (!room) return;
    if (room.host !== userId) return;

    const allReady = Object.values(room.players)
      .filter(p => !p.isHost)
      .every(p => p.ready);

    if (!allReady) return;

    room.totalRounds = Object.keys(room.players).length;
    room.round = 1;
    room.startIndex = 0;

    for (const uid of Object.keys(room.players))
      room.players[uid].score = 0;

    startRound(room);
    io.to(roomId).emit("goGamePage");
  });


  // SHOW (서버는 검증 안함 → 클라이언트 검증)
  socket.on("show", ({roomId, userId, cards})=>{
    const room = rooms[roomId];
    if (!room) return;

    const p = room.players[userId];

    p.score += room.table.length;

    p.hand = p.hand.filter(
      h => !cards.some(c => c.top===h.top && c.bottom===h.bottom)
    );

    room.table = cards;
    room.lastShowPlayer = userId;

    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);
    io.to(p.socketId).emit("yourHand", p.hand);

    nextTurn(room);
  });


  // SCOUT
  socket.on("scout", ({roomId, userId, side, flip, pos})=>{
    const room = rooms[roomId];
    if (!room || room.table.length===0) return;

    let card;
    if (room.table.length === 1) card = room.table.pop();
    else card = side==="left" ? room.table.shift() : room.table.pop();

    if (flip)
      card = { top:card.bottom, bottom:card.top };

    const p = room.players[userId];
    pos = Math.max(0, Math.min(p.hand.length, pos));
    p.hand.splice(pos, 0, card);

    if (room.lastShowPlayer && room.lastShowPlayer !== userId)
      room.players[room.lastShowPlayer].score += 1;

    io.to(p.socketId).emit("yourHand", p.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });


  // 강퇴
  socket.on("kickPlayer", ({roomId, targetUid, userId})=>{
    const room = rooms[roomId];
    if (!room) return;
    if (room.host !== userId) return;

    const t = room.players[targetUid];
    if (!t) return;

    io.to(t.socketId).emit("kicked");
    delete room.players[targetUid];

    io.to(roomId).emit("playerListUpdate", room.players);
  });


  // DISCONNECT
  socket.on("disconnect", ()=>{
    for (const rid in rooms) {
      const room = rooms[rid];

      for (const uid of Object.keys(room.players)) {
        const p = room.players[uid];

        if (p.socketId === socket.id) {
          p.isOnline = false;

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
// TURN + ROUND
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
    startingPlayer: room.turnOrder[room.currentTurn]
  });

  uids.forEach(uid=>{
    const p = room.players[uid];
    if (p.isOnli
