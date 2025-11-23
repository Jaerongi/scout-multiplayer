// ===========================================
// SCOUT Multiplayer Server (Complete Version)
// ===========================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import {
  createDeck,
  getCardValue,
  getComboType,
  isStrongerCombo,
  canInsertAt
} from "./shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// 정적 파일
app.use(express.static("public"));

// -------------------------
// 방 구조
// -------------------------
const rooms = {}; // { roomId: { players, deck, tableCombo, turnIndex, ... } }


// ======================================================
// 방 생성
// ======================================================
io.on("connection", socket => {
  console.log("User connected", socket.id);

  // -----------------------------------------
  // 방 생성
  // -----------------------------------------
  socket.on("createRoom", ({ roomId, userName, permUid }) => {
    if (rooms[roomId]) {
      socket.emit("errorMessage", "이미 존재하는 방입니다.");
      return;
    }

    rooms[roomId] = {
      roomId,
      players: [],
      deck: [],
      tableCombo: null,
      tableOwner: null,
      turnIndex: 0,
      started: false
    };

    joinPlayer(roomId, socket, userName, permUid);
  });

  // -----------------------------------------
  // 방 참가
  // -----------------------------------------
  socket.on("joinRoom", ({ roomId, userName, permUid }) => {
    if (!rooms[roomId]) {
      socket.emit("errorMessage", "존재하지 않는 방입니다.");
      return;
    }

    joinPlayer(roomId, socket, userName, permUid);
  });

  // -----------------------------------------
  // 게임 시작
  // -----------------------------------------
  socket.on("startGame", roomId => {
    const room = rooms[roomId];
    if (!room) return;

    room.deck = createDeck();

    // 각 플레이어에게 6장씩 배부
    room.players.forEach(p => {
      p.hand = room.deck.splice(0, 6).map(c => ({
        ...c,
        direction: "top" // 기본은 top
      }));
      p.score = 0;
    });

    room.started = true;
    room.turnIndex = 0;
    room.tableCombo = null;
    room.tableOwner = null;

    io.to(roomId).emit("gameStarted", {
      players: sanitize(room.players),
      turnIndex: room.turnIndex,
      tableCombo: room.tableCombo
    });
  });

  // -----------------------------------------
  // SHOW (카드 내기)
  // -----------------------------------------
  socket.on("showCombo", ({ roomId, combo }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.sid === socket.id);
    if (!player) return;

    // 1) 콤보 유효성 검사
    const valid = getComboType(combo) !== null;
    if (!valid) {
      socket.emit("errorMessage", "유효하지 않은 콤보입니다.");
      return;
    }

    // 2) 기존 테이블 콤보보다 강해야 함
    if (room.tableCombo && !isStrongerCombo(combo, room.tableCombo)) {
      socket.emit("errorMessage", "기존 콤보보다 강해야 합니다.");
      return;
    }

    // 3) 패에서 카드 제거
    combo.forEach(c => {
      const idx = player.hand.findIndex(h => h.id === c.id);
      if (idx >= 0) player.hand.splice(idx, 1);
    });

    // 4) 테이블 갱신
    room.tableCombo = combo;
    room.tableOwner = player.permUid;

    nextTurn(roomId);
  });

  // -----------------------------------------
  // SCOUT (나 가져갈래)
  // -----------------------------------------
  socket.on("scout", ({ roomId, card, direction, insertIndex }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.sid === socket.id);
    if (!player) return;

    const target = room.players.find(p => p.permUid === room.tableOwner);
    if (!target) return;

    // SCOUT 당한 사람은 1점 획득 (너가 선택한 규칙)
    target.score += 1;

    // 플레이어가 가져가는 카드 구성
    const newCard = {
      ...card,
      direction
    };

    if (!canInsertAt(player.hand.length, insertIndex)) {
      socket.emit("errorMessage", "이 위치에는 카드를 넣을 수 없습니다.");
      return;
    }

    player.hand.splice(insertIndex, 0, newCard);

    // 테이블에서 카드 1장 제거
    room.tableCombo.shift();
    if (room.tableCombo.length === 0) {
      room.tableCombo = null;
      room.tableOwner = null;
    }

    nextTurn(roomId);
  });

  // -----------------------------------------
  // PASS
  // -----------------------------------------
  socket.on("pass", roomId => {
    const room = rooms[roomId];
    if (!room) return;

    nextTurn(roomId);
  });

  // -----------------------------------------
  // 연결 끊김
  // -----------------------------------------
  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const p = room.players.find(p => p.sid === socket.id);
      if (p) {
        p.sid = null; // permUid로 재접속 가능
        updateRoom(roomId);
      }
    }
  });
});

// ======================================================
// 방 입장 처리
// ======================================================
function joinPlayer(roomId, socket, userName, permUid) {
  const room = rooms[roomId];

  // 기존 permUid가 있으면 재접속
  let player = room.players.find(p => p.permUid === permUid);

  if (player) {
    player.sid = socket.id;
    player.userName = userName;
  } else {
    room.players.push({
      sid: socket.id,
      permUid,
      userName,
      hand: [],
      score: 0
    });
  }

  socket.join(roomId);
  updateRoom(roomId);
}

// ======================================================
// 방 상태 브로드캐스트
// ======================================================
function updateRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  io.to(roomId).emit("roomUpdate", {
    players: sanitize(room.players),
    tableCombo: room.tableCombo,
    tableOwner: room.tableOwner,
    turnIndex: room.turnIndex
  });
}

// ======================================================
// 턴 넘기기
// ======================================================
function nextTurn(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.turnIndex = (room.turnIndex + 1) % room.players.length;

  updateRoom(roomId);

  checkRoundEnd(roomId);
}

// ======================================================
// 라운드 종료 조건 검사
// ======================================================
function checkRoundEnd(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  // 1) 누군가 패를 모두 비웠다면 종료
  for (const p of room.players) {
    if (p.hand.length === 0) {
      endRound(roomId, p.permUid);
      return;
    }
  }

  // 2) 모두 PASS 해서 마지막 낸 사람만 남았다 — 여기서는 PASS 카운터 필요
  // TODO: Pass 카운터 추가 (필요시)
}

// ======================================================
// 라운드 종료
// ======================================================
function endRound(roomId, winnerPermUid) {
  const room = rooms[roomId];
  if (!room) return;

  // 점수 계산
  room.players.forEach(p => {
    const minus = p.hand.length;
    p.score -= minus;
  });

  const winner = room.players.find(p => p.permUid === winnerPermUid);
  if (winner) winner.score += 10; // 보너스 점수 (원하는대로 수정 가능)

  io.to(roomId).emit("roundEnd", {
    players: sanitize(room.players),
    winner: winnerPermUid
  });
}

// 개인정보 제거
function sanitize(players) {
  return players.map(p => ({
    permUid: p.permUid,
    userName: p.userName,
    hand: p.hand,
    score: p.score
  }));
}

// 서버 실행
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("SCOUT server running on port", PORT);
});


