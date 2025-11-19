// =====================================================
// SCOUT MULTIPLAYER — SERVER (SHOW & SCOUT + CANCEL FULL VERSION)
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
httpServer.listen(PORT, () => console.log("SERVER START", PORT));


// =====================================================
// 방 정보
// =====================================================
const rooms = {};


// =====================================================
// 덱 생성 / 분배
// =====================================================
function createDeck() {
  const deck = [];
  for (let t = 1; t <= 9; t++) {
    for (let b = t + 1; b <= 10; b++) deck.push({ top: t, bottom: b });
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

  // 맞아떨어지게 제거
  const drop = deck.length % playerCount;
  for (let i = 0; i < drop; i++) deck.pop();

  const size = deck.length / playerCount;
  const res = [];

  for (let i = 0; i < playerCount; i++) {
    let hand = deck.splice(0, size);

    // 반전 랜덤
    hand = hand.map((c) =>
      Math.random() < 0.5 ? c : { top: c.bottom, bottom: c.top }
    );

    res.push(hand);
  }

  return res;
}



// =====================================================
// SOCKET
// =====================================================
io.on("connection", (socket) => {

  // JOIN ROOM
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
    const isFirst = Object.keys(room.players).length === 0;

    if (!room.players[permUid]) {
      room.players[permUid] = {
        uid: permUid,
        nickname,
        socketId: socket.id,
        isHost: isFirst,
        ready: false,
        isOnline: true,
        hand: [],
        score: 0,

        // 🔥 추가된 SCOUT 관련 상태
        scoutBonus: false,         // SCOUT 하면 SHOW 1회 가능
        lastScoutedCard: null,     // 취소 대비 임시 저장
        lastScoutedInfo: null,     // side / flip / pos
      };
      if (isFirst) room.host = permUid;
    } else {
      room.players[permUid].socketId = socket.id;
      room.players[permUid].isOnline = true;
    }

    io.to(roomId).emit("playerListUpdate", room.players);

    const started = room.turnOrder.length > 0;
    const p = room.players[permUid];

    if (started) {
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

    if (!room.players[permUid].isHost)
      room.players[permUid].ready = !room.players[permUid].ready;

    io.to(roomId).emit("playerListUpdate", room.players);
  });



  // START GAME
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
  // SHOW
  // =====================================================
  socket.on("show", ({ roomId, permUid, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[permUid];

    // 조합 비교
    if (!isStrongerCombo(cards, room.table)) {
      // SHOW 실패 → 클라이언트에서 취소/확정 선택
      io.to(player.socketId).emit("showFailed");
      return;
    }

    // SHOW 성공 =========================================

    // (1) SCOUT 보너스 확정 처리
    if (player.scoutBonus && player.lastScoutedCard) {
      const last = room.lastShowPlayer;
      if (last && last !== permUid) {
        room.players[last].score += 1;  // SCOUT 점수
      }

      // 초기화
      player.scoutBonus = false;
      player.lastScoutedCard = null;
      player.lastScoutedInfo = null;
    }

    // (2) 자기 패에서 제거
    player.hand = player.hand.filter(
      (h) => !cards.some((c) => c.top === h.top && c.bottom === h.bottom)
    );

    // (3) 테이블 반영
    room.table = cards;
    room.lastShowPlayer = permUid;

    // 업데이트
    io.to(player.socketId).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });



  // =====================================================
  // SCOUT (임시 처리 + SCOUT 보너스)
  // =====================================================
  socket.on("scout", ({ roomId, permUid, side, flip, pos }) => {
    const room = rooms[roomId];
    const player = room.players[permUid];

    if (!room || room.table.length === 0) return;

    // 카드 가져오기
    let card =
      (side === "left")
        ? room.table.shift()
        : room.table.pop();

    if (flip) card = { top: card.bottom, bottom: card.top };

    // SCOUT 보너스 부여
    player.scoutBonus = true;

    // 취소 대비 임시저장
    player.lastScoutedCard = card;
    player.lastScoutedInfo = { side, flip, pos };

    // 손패에 임시 추가 (UI용)
    pos = Math.max(0, Math.min(player.hand.length, pos));
    player.hand.splice(pos, 0, card);

    io.to(player.socketId).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);
  });



  // =====================================================
  // SHOW 실패 → SCOUT 취소
  // =====================================================
  socket.on("cancelShowScout", ({ roomId, permUid }) => {
    const room = rooms[roomId];
    const player = room.players[permUid];
    if (!room || !player) return;

    const card = player.lastScoutedCard;
    const info = player.lastScoutedInfo;
    if (!card || !info) return;

    // 손패에서 제거
    player.hand = player.hand.filter(
      (c) => !(c.top === card.top && c.bottom === card.bottom)
    );

    // 테이블로 복구
    if (info.side === "left") room.table.unshift(card);
    else room.table.push(card);

    // 보너스는 유지함
    player.lastScoutedCard = null;
    player.lastScoutedInfo = null;

    io.to(player.socketId).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.table);
    io.to(roomId).emit("playerListUpdate", room.players);
  });



  // =====================================================
  // DISCONNECT
  // =====================================================
  socket.on("disconnect", () => {
    for (const rid in rooms) {
      const room = rooms[rid];

      for (const p of Object.values(room.players))
        if (p.socketId === socket.id) p.isOnline = false;

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
    const p = room.players[uid];
    p.hand = hands[i];

    // 라운드 시작하면 SCOUT 임시상태 초기화
    p.scoutBonus = false;
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
    startingPlayer: room.turnOrder[room.currentTurn],
  });

  uids.forEach((uid) => {
    const p = room.players[uid];
    if (p.isOnline) io.to(p.socketId).emit("yourHand", p.hand);
  });

  io.to(room.roomId).emit("turnChange", room.turnOrder[room.currentTurn]);
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

    // 라운드 종결 조건
    if (room.lastShowPlayer && uid === room.lastShowPlayer) {
      const winner = room.lastShowPlayer;

      // 점수 정산
      for (const u of Object.keys(room.players)) {
        if (u !== winner) {
          room.players[u].score -= room.players[u].hand.length;
        }
      }

      io.to(room.roomId).emit("roundEnd", {
        winner,
        players: room.players,
      });

      // 모든 라운드 완료
      if (room.round >= room.totalRounds) {

        let finalWinner = null;
        let max = -9999;

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
      room.startIndex = (room.startIndex + 1) % room.turnOrder.length;

      startRound(room);
      return;
    }

    io.to(room.roomId).emit("turnChange", uid);
    return;
  }
}
