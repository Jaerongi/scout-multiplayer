// =============================
// SCOUT MULTIPLAYER – server.js (FINAL CLEAN VERSION)
// =============================
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import {
  getComboType,
  isStrongerCombo,
} from "./shared.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("public"));

app.get("/shared.js", (req, res) => {
  res.sendFile(process.cwd() + "/shared.js");
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("SERVER START", PORT);
});

const rooms = {};


// =========================================
// 공식 SCOUT 45장 덱 생성
// =========================================
function createDeck() {
  const deck = [];
  for (let top = 1; top <= 9; top++) {
    for (let bottom = top + 1; bottom <= 10; bottom++) {
      deck.push({ top, bottom });
    }
  }
  return deck;
}

// =========================================
// 셔플
// =========================================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// =========================================
// 인원수에 따라 분배 + 방향 랜덤
// =========================================
function deal(playerCount) {
  let deck = shuffle(createDeck());

  if (playerCount === 3) {
    deck = deck.filter(c => c.top !== 10 && c.bottom !== 10);
  }

  if (playerCount === 2 || playerCount === 4) {
    while (deck.length > 44) deck.pop();
  }

  const remove = deck.length % playerCount;
  for (let i = 0; i < remove; i++) deck.pop();

  const size = deck.length / playerCount;
  const hands = [];

  for (let i = 0; i < playerCount; i++) {
    let hand = deck.splice(0, size);

    hand = hand.map(c => {
      if (Math.random() < 0.5) return c;
      return { top: c.bottom, bottom: c.top };
    });

    hands.push(hand);
  }

  return hands;
}



// =========================================
// CONNECTION
// =========================================
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  // JOIN ROOM
  socket.on("joinRoom", ({ roomId, nickname }) => {
    if (!roomId || !nickname) return;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomId,
        players: {},
        turnOrder: [],
        currentTurnIndex: 0,
        tableCards: [],
        round: 1,
        host: null,
        lastShowPlayer: null, // 마지막 SHOW한 사람 기록
      };
    }

    const room = rooms[roomId];
    const isFirst = Object.keys(room.players).length === 0;

    room.players[socket.id] = {
      uid: socket.id,
      nickname,
      isHost: isFirst,
      ready: false,
      hand: [],
      score: 0,
    };

    if (isFirst) room.host = socket.id;

    io.to(roomId).emit("playerListUpdate", room.players);
  });


  // READY
  socket.on("playerReady", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.players[socket.id].isHost) return;

    room.players[socket.id].ready = !room.players[socket.id].ready;
    io.to(roomId).emit("playerListUpdate", room.players);
  });


  // START GAME
  socket.on("startGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.host !== socket.id) return;

    const allReady = Object.values(room.players)
      .filter(p => !p.isHost)
      .every(p => p.ready);

    if (!allReady) {
      io.to(socket.id).emit("errorMessage", "모든 참가자가 준비 완료되지 않았습니다!");
      return;
    }

    startRound(room);
    io.to(roomId).emit("goGamePage");
  });



  // CONFIRM FLIP
  socket.on("confirmFlip", ({ roomId, flipped }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.players[socket.id].hand = flipped;
  });



  // ============================
  // SHOW (패 제출)
  // ============================
  socket.on("show", ({ roomId, cards }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;
    const player = room.players[uid];

    // 마지막 SHOW한 사람 기록
    room.lastShowPlayer = uid;

    // SHOW 점수 = 기존 테이블 카드 수
    player.score += room.tableCards.length;

    // 내 패에서 삭제
    player.hand = player.hand.filter(
      h => !cards.some(c => c.top === h.top && c.bottom === h.bottom)
    );

    // 테이블 교체
    room.tableCards = cards;

    // 갱신
    io.to(uid).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.tableCards);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });



  // ============================
  // SCOUT
  // ============================
  socket.on("scout", ({ roomId, side, flip, pos }) => {
    const room = rooms[roomId];
    if (!room) return;

    const uid = socket.id;
    const player = room.players[uid];

    // 가져올 카드
    let take = null;
    if (room.tableCards.length === 1) {
      take = room.tableCards.pop();
    } else {
      take = (side === "left")
        ? room.tableCards.shift()
        : room.tableCards.pop();
    }

    if (!take) return;

    // 방향 뒤집기
    if (flip) take = { top: take.bottom, bottom: take.top };

    // 삽입 위치 보정
    if (pos < 0) pos = 0;
    if (pos > player.hand.length) pos = player.hand.length;

    // 핸드 삽입
    player.hand.splice(pos, 0, take);

    // ⭐ SCOUT 점수 — 제출자에게만 +1점
    if (room.lastShowPlayer) {
      room.players[room.lastShowPlayer].score += 1;
    }

    // 갱신
    io.to(uid).emit("yourHand", player.hand);
    io.to(roomId).emit("tableUpdate", room.tableCards);
    io.to(roomId).emit("playerListUpdate", room.players);

    nextTurn(room);
  });



  // DISCONNECT
  socket.on("disconnect", () => {
    for (const r in rooms) {
      const room = rooms[r];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(r).emit("playerListUpdate", room.players);
      }
    }
  });

}); // END io.on("connection")




// =========================================
// ROUND START
// =========================================
function startRound(room) {
  const uids = Object.keys(room.players);
  const hands = deal(uids.length);

  uids.forEach((uid, i) => {
    room.players[uid].hand = hands[i];
  });

  room.turnOrder = uids;
  room.currentTurnIndex = 0;
  room.tableCards = [];
  room.lastShowPlayer = null;

  io.to(room.roomId).emit("roundStart", {
    round: room.round,
    players: room.players,
    startingPlayer: room.turnOrder[0],
  });

  uids.forEach(uid => {
    io.to(uid).emit("yourHand", room.players[uid].hand);
  });

  io.to(room.roomId).emit("turnChange", room.turnOrder[0]);
}



// =========================================
// TURN CHANGE + 승리 조건 체크
// =========================================
function nextTurn(room) {

  room.currentTurnIndex =
    (room.currentTurnIndex + 1) % room.turnOrder.length;

  const currentPlayer = room.turnOrder[room.currentTurnIndex];

  // === 승리 조건 ===
  // 모두 SCOUT만 해서 → 마지막 SHOW한 사람에게 턴이 돌아옴
  if (room.lastShowPlayer && currentPlayer === room.lastShowPlayer) {

    const winner = room.lastShowPlayer;

    // 점수 계산
    for (const uid of Object.keys(room.players)) {
      const player = room.players[uid];

      if (uid === winner) {
        // 승리자 0점
        player.score += 0;
      } else {
        // 패 남은 장수 × -1
        player.score -= player.hand.length;
      }
    }

    // 라운드 종료 알림
    io.to(room.roomId).emit("roundEnd", {
      winner,
      players: room.players
    });

    // 다음 라운드
    room.round++;
    startRound(room);
    return;
  }

  // 턴 넘기기
  io.to(room.roomId).emit("turnChange", currentPlayer);
}

