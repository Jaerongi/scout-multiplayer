// =====================================================
// SCOUT MULTIPLAYER — SERVER FINAL + SHOW&SCOUT EXTENDED
// =====================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { getComboType, isStrongerCombo } from "./shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));
app.get("/shared.js", (req, res) =>
  res.sendFile(process.cwd() + "/shared.js")
);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log("SERVER START", PORT));

// =====================================
// 방 데이터
// =====================================
const rooms = {};

// =====================================
// 덱 생성
// =====================================
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

  // 규칙: 2/4인 경기에서 45장 안 나올 때 제거
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

// =====================================
// SOCKET.IO
// =====================================
io.on("connection", (socket) => {
  // JOIN ROOM
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
        lastShowPlayer: null,

        // 라운드 제어 변수
        startIndex: 0,
        totalRounds: 0,
      };
    }

    const room = rooms[roomId];
    const isFirst = Object.keys(room.players).length === 0;

    // 기존 플레이어 여부 확인
    if (!room.players[permUid]) {
      room.players[permUid] = {
        uid: permUid,
        nickname,
        socketId: socket.id,
        isHost: isFirst,
        ready: false,
        hand: [],
        score: 0,
        isOnline: true,

        // SHOW & SCOUT 확장 변수
        scoutShowMode: false,    // SCOUT 후 SHOW까지 진행해야 하는지
        lastScoutedCard: null,   // 가져온 카드 임시저장
        lastScoutedInfo: null,   // 원래 위치 복원 정보
      };
      if (isFirst) room.host = permUid;
    } else {
      room.players[permUid].socketId = socket.id;
      room.players[permUid].isOnline = true;
    }

    io.to(roomId).emit("playerListUpdate", {
      players: room.players,
      turnOrder: room.turnOrder,
    });

    const gameStarted = room.turnOrder.length > 0;
    const p = room.players[permUid];

    if (gameStarted) {
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
  socket.on("playerReady", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (!room.players[permUid].isHost)
      room.players[permUid].ready = !room.players[permUid].ready;

    io.to(roomId).emit("playerListUpdate", {
      players: room.players,
      turnOrder: room.turnOrder,
    });
  });

  // START GAME
  socket.on("startGame", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room || room.host !== permUid) return;

    // 모든 비방장 플레이어가 ready인지 확인
    const readyOK = Object.values(room.players)
      .filter((p) => !p.isHost)
      .every((p) => p.ready);
    if (!readyOK) return;

    room.totalRounds = Object.keys(room.players).length;
    room.round = 1;
    room.startIndex = 0;

    startRound(room);
    io.to(roomId).emit("goGamePage");
  });

  // -----------------------------------------------------
  // SHOW (일반 SHOW + SHOW&SCOUT SHOW)
  // -----------------------------------------------------
  socket.on("show", ({ roomId, permUid, cards }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players[permUid];

    // 테이블이 비어있지 않을 때만 비교
    if (room.table.length > 0 && !isStrongerCombo(cards, room.table)) {
      // SHOW 실패
      if (player.scoutShowMode) {
        // SCOUT 후 SHOW 시도 → 실패 → 클라이언트에게 실패 알림
        io.to(player.socketId).emit("showFailed");
        return;
      } else {
        // 일반 SHOW 실패 허용 안함
        return;
      }
    }

    // ========== SHOW 성공 ==========
    // 일반 SHOW 점수: 테이블 카드 수를 점수로 획득
    player.score += room.table.length;

    // 손패에서 선택된 카드 제거
    player.hand = player.hand.filter(
      (h) => !cards.some((c) => c.top === h.top && c.bottom === h.bottom)
    );

    room.table = cards;
    room.lastShowPlayer = permUid;

    // 🔥 SHOW&SCOUT 모드 종료
    if (player.scoutShowMode) {
      player.scoutShowMode = false;
      player.lastScoutedCard = null;
      player.lastScoutedInfo = null;
    }

    // 업데이트
    io.to(player.socketId).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", {
      players: room.players,
      turnOrder: room.turnOrder,
    });

    nextTurn(room);
  });

  // -----------------------------------------------------
  // SCOUT (일반 + SHOW&SCOUT 모두 처리)
  // -----------------------------------------------------
  socket.on("scout", ({ roomId, permUid, side, flip, pos }) => {
    const room = rooms[roomId];
    if (!room || room.table.length === 0) return;

    const player = room.players[permUid];

    // 가져오기
    let card;
    if (room.table.length === 1) card = room.table.pop();
    else card = side === "left" ? room.table.shift() : room.table.pop();

    if (flip) card = { top: card.bottom, bottom: card.top };

    pos = Math.max(0, Math.min(player.hand.length, pos));
    player.hand.splice(pos, 0, card);

    // ★ SHOW&SCOUT 모드일 때는 턴 유지 + 카드 임시 저장
    if (player.scoutShowMode) {
      player.lastScoutedCard = card;
      player.lastScoutedInfo = { side, flip, pos };

      io.to(player.socketId).emit("yourHand", player.hand);
      io.to(roomId).emit("tableUpdate", room.table);
      return; // 턴 유지
    }

    // ★ 일반 SCOUT: 점수 + 턴 종료
    if (room.lastShowPlayer && room.lastShowPlayer !== permUid)
      room.players[room.lastShowPlayer].score += 1;

    io.to(player.socketId).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", {
      players: room.players,
      turnOrder: room.turnOrder,
    });

    nextTurn(room); // 턴 종료
  });

  // -----------------------------------------------------
  // SHOW 실패 → SHOW&SCOUT 취소
  // -----------------------------------------------------
  socket.on("cancelShowScout", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    const player = room.players[permUid];
    if (!room || !player) return;

    const card = player.lastScoutedCard;
    const info = player.lastScoutedInfo;

    if (!card || !info) return;

    // 손패에서 삭제
    player.hand = player.hand.filter(
      (h) => !(h.top === card.top && h.bottom === card.bottom)
    );

    // 테이블 복원
    if (info.side === "left") room.table.unshift(card);
    else room.table.push(card);

    player.lastScoutedCard = null;
    player.lastScoutedInfo = null;

    io.to(player.socketId).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);

    // 클라이언트에게 재시작 알림
    io.to(player.socketId).emit("cancelShowScoutDone");
  });

  // -----------------------------------------------------
  // 시작: SHOW&SCOUT 모드 진입 알림
  // -----------------------------------------------------
  socket.on("startShowScout", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[permUid];
    player.scoutShowMode = true;

    io.to(player.socketId).emit("enterScoutMode", permUid);
  });

  // -----------------------------------------------------
  // DISCONNECT
  // -----------------------------------------------------
  socket.on("disconnect", () => {
    for (const rid in rooms) {
      const room = rooms[rid];
      for (const p of Object.values(room.players))
        if (p.socketId === socket.id) p.isOnline = false;

      io.to(rid).emit("playerListUpdate", {
        players: room.players,
        turnOrder: room.turnOrder,
      });
    }
  });
});

// =====================================
// 라운드 시작
// =====================================
function startRound(room) {
  const uids = Object.keys(room.players);
  const hands = deal(uids.length);

  uids.forEach((uid, i) => {
    const p = room.players[uid];
    p.hand = hands[i];

    // SCOUTSHOW 모드 초기화
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
    turnOrder: room.turnOrder,
  });

  // 각 플레이어에게 손패 전송
  uids.forEach((uid) => {
    const p = room.players[uid];
    if (p.isOnline) io.to(p.socketId).emit("yourHand", p.hand);
  });

  // 첫 턴 알림
  io.to(room.roomId).emit("turnChange", room.turnOrder[room.currentTurn]);
}

// =====================================
// 턴 진행
// =====================================
function nextTurn(room) {
  for (let i = 0; i < room.turnOrder.length; i++) {
    room.currentTurn =
      (room.currentTurn + 1) % room.turnOrder.length;

    const uid = room.turnOrder[room.currentTurn];
    const p = room.players[uid];

    if (!p.isOnline) continue;

    // 라운드 종료 조건
    if (room.lastShowPlayer && uid === room.lastShowPlayer) {
      const winner = room.lastShowPlayer;

      // 점수 계산
      for (const u of Object.keys(room.players)) {
        if (u !== winner)
          room.players[u].score -= room.players[u].hand.length;
      }

      io.to(room.roomId).emit("roundEnd", {
        winner,
        players: room.players,
      });

      // 게임 종료
      if (room.round >= room.totalRounds) {
        let finalWinner = null;
        let max = -999999;
        for (const u of Object.keys(room.players)) {
          if (room.players[u].score > max) {
            max = room.players[u].score;
            finalWinner = u;
          }
        }

        io.to(room.roomId).emit("gameOver", {
          winner: finalWinner,
          players: room.players,
        });

        return;
      }

      // 다음 라운드
      room.round++;
      room.startIndex =
        (room.startIndex + 1) % room.turnOrder.length;

      startRound(room);
      return;
    }

    // 정상 턴 이동
    io.to(room.roomId).emit("turnChange", uid);
    return;
  }
}
