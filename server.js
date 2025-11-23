// ===========================================
// SCOUT Multiplayer Server (Railway 안정버전 완성)
// ===========================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import {
  createDeck,
  getComboType,
  isStrongerCombo,
  canInsertAt
} from "./shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// 정적 파일 제공 (public 폴더)
app.use(express.static("public"));

// 모든 방 정보 저장
const rooms = {}; // { roomId: { players, deck, ... } }

// ===========================================
// 소켓 연결
// ===========================================
io.on("connection", socket => {
  console.log("Client connected:", socket.id);

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

    // 덱 생성
    room.deck = createDeck();

    // 각 플레이어 핸드 6장씩 분배
    room.players.forEach(p => {
      p.hand = room.deck.splice(0, 6).map(c => ({
        ...c,
        direction: "top"
      }));
      p.score = p.score || 0;
    });

    room.started = true;
    room.turnIndex = 0;
    room.tableCombo = null;
    room.tableOwner = null;

    io.to(roomId).emit("gameStarted", {
      players: sanitize(room.players),
      tableCombo: room.tableCombo,
      turnIndex: room.turnIndex
    });

    updateRoom(roomId);
  });

  // -----------------------------------------
  // SHOW
  // -----------------------------------------
  socket.on("showCombo", ({ roomId, combo }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.sid === socket.id);
    if (!player) return;

    const valid = getComboType(combo) !== null;
    if (!valid) {
      socket.emit("errorMessage", "유효하지 않은 콤보입니다.");
      return;
    }

    // 기존보다 강해야 함
    if (room.tableCombo && !isStrongerCombo(combo, room.tableCombo)) {
      socket.emit("errorMessage", "기존 콤보보다 강해야 합니다.");
      return;
    }

    // 플레이어 패에서 카드 제거
    combo.forEach(c => {
      const idx = player.hand.findIndex(h => h.id === c.id);
      if (idx >= 0) player.hand.splice(idx, 1);
    });

    // 테이블 갱신
    room.tableCombo = combo;
    room.tableOwner = player.permUid;

    nextTurn(roomId);
  });

  // -----------------------------------------
  // SCOUT
  // -----------------------------------------
  socket.on("scout", ({ roomId, card, direction, insertIndex }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.sid === socket.id);
    if (!player) return;

    const owner = room.players.find(p => p.permUid === room.tableOwner);
    if (owner) owner.score += 1; // 룰북: SCOUT 당한 사람 1점

    if (!canInsertAt(player.hand.length, insertIndex)) {
      socket.emit("errorMessage", "해당 위치에 넣을 수 없습니다.");
      return;
    }

    // 플레이어 패에 삽입
    player.hand.splice(insertIndex, 0, {
      ...card,
      direction
    });

    // 테이블에서 카드 제거
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
    nextTurn(roomId);
  });

  // -----------------------------------------
  // 연결 해제
  // -----------------------------------------
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];
      const p = room.players.find(p => p.sid === socket.id);
      if (p) {
        p.sid = null; // 재접속 위해 남겨둠
        updateRoom(roomId);
      }
    }
  });
});

// ===========================================
// 공통 함수들
// ===========================================

function joinPlayer(roomId, socket, userName, permUid) {
  const room = rooms[roomId];

  let p = room.players.find(p => p.permUid === permUid);

  if (p) {
    // 재접속
    p.sid = socket.id;
    p.userName = userName;
  } else {
    // 신규 참가자
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

  // ⭐ 클라이언트에게 "입장 성공" 신호를 보내는 필수 코드
  socket.emit("joinedRoom", roomId);
}

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

function nextTurn(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.turnIndex = (room.turnIndex + 1) % room.players.length;
  updateRoom(roomId);
}

function sanitize(players) {
  return players.map(p => ({
    permUid: p.permUid,
    userName: p.userName,
    hand: p.hand,
    score: p.score
  }));
}

// ===========================================
// Railway용 서버 실행
// ===========================================
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`SCOUT server running on port ${PORT}`);
});
