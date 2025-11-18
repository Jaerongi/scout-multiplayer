// =====================================================
// SCOUT MULTIPLAYER — SERVER FULL VERSION (PART 1)
// 회원가입 / 로그인 / 관리자 / 정적 파일
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

// ------------------------------------------------------
// JSON DB 유틸
// ------------------------------------------------------
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
// 회원가입 / 로그인 API
// =====================================================
app.post("/api/login", (req, res) => {
  const nickname = req.body.nickname.trim();
  if (!nickname) return res.json({ ok: false });

  const db = loadUserDB();

  const exist = Object.keys(db.users).find(
    uid => db.users[uid].nickname === nickname
  );

  if (exist) {
    return res.json({ ok: true, userId: exist });
  }

  const tag = shortUUID();
  const userId = `${nickname}-${tag}`;

  db.users[userId] = { nickname, tag };
  saveUserDB(db);

  res.json({ ok: true, userId });
});


// =====================================================
// 관리자 API
// =====================================================
app.post("/api/admin/login", (req, res) => {
  const { id, pw } = req.body;
  const admin = loadAdminDB().admin;

  if (admin.id === id && admin.pw === pw) {
    return res.json({ ok: true });
  }

  res.json({ ok: false });
});

app.get("/api/admin/users", (req, res) => {
  const db = loadUserDB();
  res.json(Object.keys(db.users).map(uid => db.users[uid].nickname));
});

app.post("/api/admin/deleteUser", (req, res) => {
  const { nickname } = req.body;
  const db = loadUserDB();

  const key = Object.keys(db.users).find(
    uid => db.users[uid].nickname === nickname
  );

  if (!key) return res.json({ ok: false });

  delete db.users[key];
  saveUserDB(db);

  res.json({ ok: true });
});

// 관리자 페이지 라우트
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});


// =====================================================
// 게임 자료 구조 + 덱 생성
// =====================================================
const rooms = {};

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
// SOCKET.IO — 게임 플레이 전체 처리 (PART 2)
// =====================================================
io.on("connection", (socket) => {

  // ---------------------------------------------------
  // JOIN ROOM (회원 기반 userId)
  // ---------------------------------------------------
  socket.on("joinRoom", ({ roomId, userId }) => {
    if (!roomId || !userId) return;

    const db = loadUserDB();
    if (!db.users[userId]) return; // 존재하지 않는 계정이면 무시

    const nickname = db.users[userId].nickname;

    socket.join(roomId);

    // 방 없으면 생성
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

    // 신규 입장 or 재접속
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
      // 재접속
      room.players[userId].socketId = socket.id;
      room.players[userId].isOnline = true;
    }

    // 플레이어 목록 갱신
    io.to(roomId).emit("playerListUpdate", room.players);

    // 게임 중이라면 상태 복구
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


  // ---------------------------------------------------
  // READY 토글
  // ---------------------------------------------------
  socket.on("playerReady", ({ roomId, userId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (!room.players[userId].isHost)
      room.players[userId].ready = !room.players[userId].ready;

    io.to(roomId).emit("playerListUpdate", room.players);
  });


  // ---------------------------------------------------
  // START GAME
  // ---------------------------------------------------
  socket.on("startGame", ({ roomId, userId }) => {
    const room = rooms[roomId];
    if (!room) return;

    // 방장만 가능
    if (room.host !== userId) return;

    const everyoneReady = Object.values(room.players)
      .filter(p => !p.isHost)
      .every(p => p.ready);

    if (!everyoneReady) return;

    room.totalRounds = Object.keys(room.players).length;
    room.round = 1;
    room.startIndex = 0;

    // 점수 초기화
    for (const uid of Object.keys(room.players)) {
      room.players[uid].score = 0;
    }

    // 라운드 시작
    startRound(room);

    io.to(roomId).emit("goGamePage");
  });


  // ---------------------------------------------------
  // SHOW (조합 검증은 client 전용)
  // ---------------------------------------------------
  socket.on("show", ({ roomId, userId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const p = room.players[userId];

    // SCORE: SHOW 시 테이블 위 카드수만큼 +점수
    p.score += room.table.length;

    // 핸드에서 제거
    p.hand = p.hand.filter(
      h => !cards.some(c => c.top === h.top && c.bottom === h.bottom)
    );

    // 테이블 업데이트
    room.table = cards;
    room.lastShowPlayer = userId;

    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);
    io.to(p.socketId).emit("yourHand", p.hand);

    nextTurn(room);
  });


  // ---------------------------------------------------
  // SCOUT
  // ---------------------------------------------------
  socket.on("scout", ({ roomId, userId, side, flip, pos }) => {
    const room = rooms[roomId];
    if (!room || room.table.length === 0) return;

    let card;
    if (room.table.length === 1) {
      card = room.table.pop();
    } else {
      card = side === "left" ? room.table.shift() : room.table.pop();
    }

    if (flip) {
      card = { top: card.bottom, bottom: card.top };
    }

    const p = room.players[userId];

    // 위치 보정
    pos = Math.max(0, Math.min(p.hand.length, pos));
    p.hand.splice(pos, 0, card);

    // SCOUT 점수: 마지막 SHOW한 플레이어에게 +1
    if (room.lastShowPlayer && room.lastShowPlayer !== userId) {
      room.players[room.lastShowPlayer].score += 1;
    }

    io.to(p.socketId).emit("yourHand", p.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });


  // ---------------------------------------------------
  // 강퇴
  // ---------------------------------------------------
  socket.on("kickPlayer", ({ roomId, targetUid, userId }) => {
    const room = rooms[roomId];
    if (!room) return;

    // 방장만 가능
    if (room.host !== userId) return;

    const t = room.players[targetUid];
    if (!t) return;

    io.to(t.socketId).emit("kicked");
    delete room.players[targetUid];

    io.to(roomId).emit("playerListUpdate", room.players);
  });


  // ---------------------------------------------------
  // DISCONNECT
  // ---------------------------------------------------
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
// ROUND START
// =====================================================
function startRound(room) {
  const uids = Object.keys(room.players);
  const hands = deal(uids.length);

  // 각 플레이어에게 핸드 배분
  uids.forEach((uid, i) => {
    room.players[uid].hand = hands[i];
  });

  // 기본 변수들 초기화
  room.turnOrder = [...uids];
  room.currentTurn = room.startIndex;
  room.table = [];
  room.lastShowPlayer = null;

  // 라운드 시작 알림
  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[room.currentTurn]
  });

  // 각 플레이어에게 자신의 패 전송
  uids.forEach((uid) => {
    const p = room.players[uid];
    if (p.isOnline) {
      io.to(p.socketId).emit("yourHand", p.hand);
    }
  });

  // 첫 턴 알림
  io.to(room.roomId).emit("turnChange", room.turnOrder[room.currentTurn]);
}


// =====================================================
// NEXT TURN — 쇼 성공 시 라운드 종료 / 일반 턴
// =====================================================
function nextTurn(room) {
  const total = room.turnOrder.length;

  for (let i = 0; i < total; i++) {
    room.currentTurn = (room.currentTurn + 1) % total;
    const uid = room.turnOrder[room.currentTurn];
    const p = room.players[uid];

    if (!p.isOnline) continue;

    // 🔥 라운드 종료 조건: 마지막 SHOW 한 사람이 자신의 턴을 맞으면 종료
    if (room.lastShowPlayer && room.lastShowPlayer === uid) {
      const winner = room.lastShowPlayer;

      // 패널티 점수: 승자를 제외한 모든 사람의 패 수 만큼 점수 차감
      for (const u of Object.keys(room.players)) {
        if (u !== winner) {
          room.players[u].score -= room.players[u].hand.length;
        }
      }

      // 클라이언트에 라운드 종료 알림
      io.to(room.roomId).emit("roundEnd", {
        winner,
        players: room.players
      });

      // 🔥 전체 라운드 종료?
      if (room.round >= room.totalRounds) {
        let finalWinner = null;
        let maxScore = -999999;

        for (const uid of Object.keys(room.players)) {
          const score = room.players[uid].score;
          if (score > maxScore) {
            maxScore = score;
            finalWinner = uid;
          }
        }

        io.to(room.roomId).emit("gameOver", {
          winner: finalWinner,
          players: room.players
        });

        return;
      }

      // 🔥 다음 라운드 준비
      room.round++;
      room.startIndex = (room.startIndex + 1) % total;

      startRound(room);
      return;
    }

    // 일반 턴 진행
    io.to(room.roomId).emit("turnChange", uid);
    return;
  }
}


// =====================================================
// SERVER START
// =====================================================
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`SERVER STARTED ON PORT ${PORT}`);
});
