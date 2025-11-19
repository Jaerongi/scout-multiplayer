// =====================================================
// SERVER — SHOW & SCOUT FULL SYSTEM
// =====================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { getComboType, isStrongerCombo } from "./shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));
app.get("/shared.js", (req, res) => res.sendFile(process.cwd() + "/shared.js"));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log("SERVER START", PORT));

// =============================================
// ROOM DATA
// =============================================
const rooms = {};


// 덱 생성 / 분배 --------------------------------------
function createDeck() {
  const deck = [];
  for (let t = 1; t <= 9; t++) {
    for (let b = t + 1; b <= 10; b++) deck.push({ top: t, bottom: b });
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

function deal(n) {
  let deck = shuffle(createDeck());

  if (n === 3)
    deck = deck.filter((c) => c.top !== 10 && c.bottom !== 10);

  if (n === 2 || n === 4)
    while (deck.length > 44) deck.pop();

  const drop = deck.length % n;
  for (let i = 0; i < drop; i++) deck.pop();

  const size = deck.length / n;
  const hands = [];

  for (let i = 0; i < n; i++) {
    let hand = deck.splice(0, size);
    hand = hand.map((c) =>
      Math.random() < 0.5 ? c : { top: c.bottom, bottom: c.top }
    );
    hands.push(hand);
  }

  return hands;
}



// =====================================================
// SOCKET
// =====================================================
io.on("connection", (socket) => {

  // JOIN
  socket.on("joinRoom", ({ roomId, nickname, permUid }) => {

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

    if (!room.players[permUid]) {
      room.players[permUid] = {
        uid: permUid,
        nickname,
        socketId: socket.id,
        isHost: first,
        ready: false,
        isOnline: true,
        hand: [],
        score: 0,

        // SHOW & SCOUT 모드 상태
        scoutShowMode: false,    // true면 SCOUT 후 SHOW까지 해야 끝남
        lastScoutedCard: null,
        lastScoutedInfo: null,
      };
      if (first) room.host = permUid;
    } else {
      room.players[permUid].socketId = socket.id;
      room.players[permUid].isOnline = true;
    }

    io.to(roomId).emit("playerListUpdate", {
      players: room.players,
      turnOrder: room.turnOrder
    });

    const started = room.turnOrder.length > 0;

    if (started) {
      const p = room.players[permUid];
      io.to(socket.id).emit("restoreState", {
        players: room.players,
        hand: p.hand,
        table: room.table,
        turn: room.turnOrder[room.currentTurn],
        round: room.round,
      });
    }
  });



  // READY
  socket.on("playerReady", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (!room.players[permUid].isHost)
      room.players[permUid].ready = !room.players[permUid].ready;

    io.to(roomId).emit("playerListUpdate", {
      players: room.players,
      turnOrder: room.turnOrder
    });
  });



  // START
  socket.on("startGame", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room || room.host !== permUid) return;

    const ok = Object.values(room.players)
      .filter((p) => !p.isHost)
      .every((p) => p.ready);

    if (!ok) return;

    room.totalRounds = Object.keys(room.players).length;
    room.round = 1;
    room.startIndex = 0;

    startRound(room);

    io.to(roomId).emit("goGamePage");
  });



  // =====================================================
  // SHOW ONLY
  // =====================================================
  socket.on("show", ({ roomId, permUid, cards }) => {
    const room = rooms[roomId];
    const p = room.players[permUid];
    if (!room || !p) return;

    if (!isStrongerCombo(cards, room.table)) {
      io.to(p.socketId).emit("showFailed");
      return;
    }

    // 정상 SHOW
    p.hand = p.hand.filter(
      (h) => !cards.some((c) => c.top === h.top && c.bottom === h.bottom)
    );

    room.table = cards;
    room.lastShowPlayer = permUid;

    // SCOUT 보너스 점수
    if (p.scoutShowMode) {
      const last = room.lastShowPlayer;
      if (last && last !== permUid) {
        room.players[last].score += 1;
      }
      p.scoutShowMode = false;
      p.lastScoutedCard = null;
      p.lastScoutedInfo = null;
    }

    io.to(p.socketId).emit("yourHand", p.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", {
      players: room.players,
      turnOrder: room.turnOrder
    });

    nextTurn(room);
  });



  // =====================================================
  // SHOW & SCOUT 버튼 → SCOUT 모드 시작
  // =====================================================
  socket.on("startShowScout", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    const p = room.players[permUid];
    if (!room || !p) return;

    // SHOW & SCOUT 모드 진입
    p.scoutShowMode = true;

    io.to(roomId).emit("enterScoutMode", permUid);
  });



  // =====================================================
  // SCOUT 수행 (SHOW&SCOUT or 일반 SCOUT 모두 여기로 처리)
  // =====================================================
  socket.on("scout", ({ roomId, permUid, side, flip, pos }) => {
    const room = rooms[roomId];
    const p = room.players[permUid];
    if (!room || !p) return;

    let card =
      side === "left" ? room.table.shift() : room.table.pop();

    if (flip) card = { top: card.bottom, bottom: card.top };

    pos = Math.max(0, Math.min(p.hand.length, pos));
    p.hand.splice(pos, 0, card);

    // SHOW & SCOUT 모드라면 → 턴 유지
    if (p.scoutShowMode) {
      p.lastScoutedCard = card;
      p.lastScoutedInfo = { side, flip, pos };

      io.to(p.socketId).emit("yourHand", p.hand);
      io.to(roomId).emit("tableUpdate", room.table);
      return;
    }

    // 일반 SCOUT → SCOUT 점수 반영 & 턴 종료
    const last = room.lastShowPlayer;
    if (last && last !== permUid) {
      room.players[last].score += 1;
    }

    io.to(p.socketId).emit("yourHand", p.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", {
      players: room.players,
      turnOrder: room.turnOrder
    });

    nextTurn(room);
  });



  // =====================================================
  // SHOW 실패 → SHOW & SCOUT 취소
  // =====================================================
  socket.on("cancelShowScout", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    const p = room.players[permUid];
    if (!room || !p) return;

    const card = p.lastScoutedCard;
    const info = p.lastScoutedInfo;
    if (!card || !info) return;

    // 1) 손패에서 제거
    p.hand = p.hand.filter(
      (h) => !(h.top === card.top && h.bottom === card.bottom)
    );

    // 2) 테이블에 복원
    if (info.side === "left") room.table.unshift(card);
    else room.table.push(card);

    // 3) SHOW & SCOUT 모드 유지
    p.lastScoutedCard = null;
    p.lastScoutedInfo = null;

    io.to(p.socketId).emit("yourHand", p.hand);
    io.to(roomId).emit("tableUpdate", room.table);

    // 다시 SHOW&SCOUT 모드 계속
    io.to(p.socketId).emit("cancelShowScoutDone");
  });



  // DISCONNECT
  socket.on("disconnect", () => {
    for (const rid in rooms) {
      const room = rooms[rid];
      for (const p of Object.values(room.players))
        if (p.socketId === socket.id) p.isOnline = false;

      io.to(rid).emit("playerListUpdate", {
        players: room.players,
        turnOrder: room.turnOrder
      });
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
    const p = room.players[uid];

    p.hand = hands[i];
    p.scoutShowMode = false;
    p.lastScoutedCard = null;
    p.lastScoutedInfo = null;
  });

  room.turnOrder = [...uids];
  room.currentTurn = room.startIndex;
  room.table = [];
  room.lastShowPlayer = null;

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    turnOrder: room.turnOrder
  });

  for (const uid of uids) {
    const p = room.players[uid];
    if (p.isOnline)
      io.to(p.socketId).emit("yourHand", p.hand);
  }

  io.to(room.roomId).emit(
    "turnChange",
    room.turnOrder[room.currentTurn]
  );
}



// =====================================================
// 턴 진행
// =====================================================
function nextTurn(room) {

  for (let i = 0; i < room.turnOrder.length; i++) {
    room.currentTurn = (room.currentTurn + 1) % room.turnOrder.length;

    const uid = room.turnOrder[room.currentTurn];
    const p = room.players[uid];

    if (!p.isOnline) continue;

    // 라운드 종료 판단
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
        let max = -99999;

        for (const id of Object.keys(room.players)) {
          if (room.players[id].score > max) {
            max = room.players[id].score;
            finalWinner = id;
          }
        }

        io.to(room.roomId).emit("gameOver", {
          winner: finalWinner,
          players: room.players,
        });

        return;
      }

      room.round++;
      room.startIndex =
        (room.startIndex + 1) % room.turnOrder.length;

      startRound(room);
      return;
    }

    io.to(room.roomId).emit("turnChange", uid);
    return;
  }
}
