// =====================================================
// SCOUT MULTIPLAYER — ULTIMATE SERVER (RECONNECT + AUTO SKIP)
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
// 분배 + 랜덤 방향
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
        lastShowPlayer: null
      };
    }

    const room = rooms[roomId];
    const isFirst = Object.keys(room.players).length === 0;

    // -------------------------------------------
    // 플레이어 신규 또는 복구
    // -------------------------------------------
    if (!room.players[permUid]) {
      // 신규 입장
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
      // 재접속 복구
      room.players[permUid].socketId = socket.id;
      room.players[permUid].isOnline = true;
    }

    io.to(roomId).emit("playerListUpdate", room.players);

    // -------------------------------------------
    // 상태 복구 전송
    // -------------------------------------------
    const p = room.players[permUid];

    if (p.hand.length > 0 || room.round > 1) {
      io.to(socket.id).emit("restoreState", {
        hand: p.hand,
        score: p.score,
        table: room.table,
        round: room.round,
        players: room.players,
        turn: room.turnOrder[room.currentTurn]
      });
    }
  });

  // READY
  socket.on("playerReady", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.players[permUid].isHost) return;

    room.players[permUid].ready = !room.players[permUid].ready;
    io.to(roomId).emit("playerListUpdate", room.players);
  });


  // 게임 시작
  socket.on("startGame", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.host !== permUid) return;

    const ok = Object.values(room.players)
      .filter(p => !p.isHost)
      .every(p => p.ready);

    if (!ok) return;

    startRound(room);
    io.to(roomId).emit("goGamePage");
  });


  // 방향 확정
  socket.on("confirmFlip", ({ roomId, permUid, flipped }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.players[permUid].hand = flipped;
  });


  // =====================================================
  // SHOW
  // =====================================================
  socket.on("show", ({ roomId, permUid, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[permUid];

    // 점수: 기존 테이블 카드 수
    player.score += room.table.length;

    // 패에서 제거
    player.hand = player.hand.filter(
      h => !cards.some(c => c.top === h.top && c.bottom === h.bottom)
    );

    // 테이블 갱신
    room.table = cards;

    // 마지막 SHOW 플레이어 저장
    room.lastShowPlayer = permUid;

    io.to(player.socketId).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });


  // =====================================================
  // SCOUT
  // =====================================================
  socket.on("scout", ({ roomId, permUid, side, flip, pos }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[permUid];

    if (room.table.length === 0) return;

    let card;

    if (room.table.length === 1) card = room.table.pop();
    else card = (side === "left") ? room.table.shift() : room.table.pop();

    if (flip) card = { top: card.bottom, bottom: card.top };

    pos = Math.max(0, Math.min(pos, player.hand.length));
    player.hand.splice(pos, 0, card);

    // 스카우트 점수: 제출자 +1
    const s = room.lastShowPlayer;
    if (s && s !== permUid) room.players[s].score += 1;

    io.to(player.socketId).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });


  // =====================================================
  // disconnect → 삭제 X, 오프라인 표시
  // =====================================================
  socket.on("disconnect", () => {
    for (const rid in rooms) {
      const room = rooms[rid];

      for (const p of Object.values(room.players)) {
        if (p.socketId === socket.id) {
          p.isOnline = false;
        }
      }

      io.to(rid).emit("playerListUpdate", room.players);
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
    const p = room.players[uid];
    if (p.isOnline) io.to(p.socketId).emit("yourHand", p.hand);
  });

  io.to(room.roomId).emit("turnChange", room.turnOrder[0]);
}


// =====================================================
// 턴 스킵 포함한 턴 진행
// =====================================================
function nextTurn(room) {

  // 최대 room.turnOrder.length 만큼 루프 → 무한 루프 방지
  for (let i = 0; i < room.turnOrder.length; i++) {

    room.currentTurn =
      (room.currentTurn + 1) % room.turnOrder.length;

    const uid = room.turnOrder[room.currentTurn];
    const player = room.players[uid];

    // --------------------------------------------
    // 오프라인이면 자동 스킵
    // --------------------------------------------
    if (!player.isOnline) continue;

    // --------------------------------------------
    // 라운드 종료 판정
    // --------------------------------------------
    if (room.lastShowPlayer && uid === room.lastShowPlayer) {

      const winner = room.lastShowPlayer;

      // 점수 계산
      for (const u of Object.keys(room.players)) {
        const p = room.players[u];
        if (u === winner) continue;

        p.score -= p.hand.length;
      }

      io.to(room.roomId).emit("roundEnd", {
        winner,
        players: room.players
      });

      room.round++;
      startRound(room);
      return;
    }

    // 정상 턴 전달
    io.to(room.roomId).emit("turnChange", uid);
    return;
  }
}
