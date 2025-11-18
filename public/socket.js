// =====================================================
// SOCKET.JS — 초대링크 / 방 / 게임UI 통합버전 (2025 FINAL)
// =====================================================

// 로그인 체크
window.userId = localStorage.getItem("scout_userId");
if (!window.userId) location.href = "/login.html";

window.socket = io({ transports:["websocket"], autoConnect:true });
window.roomId = null;

// ------------------------------
// 페이지 전환
// ------------------------------
window.showPage = function (page) {
  ["startPage","roomPage","gamePage"].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  document.getElementById(page).style.display = "block";
};


// =====================================================
// 소켓 연결 이후
// =====================================================
socket.on("connect", () => {
  const params = new URLSearchParams(location.search);
  const rid = params.get("room");

  // 초대링크 로그인 처리
  if (rid && !window.userId) {
    localStorage.setItem("inviteRoom", rid);
    location.href = "/login.html";
    return;
  }

  // 로그인 되어 있고 초대링크 있음
  if (rid && window.userId) {
    window.roomId = rid;

    socket.emit("joinRoom", { roomId:rid, userId:window.userId });

    document.getElementById("roomTitle").innerText = "방번호: " + rid;

    setTimeout(()=> showPage("roomPage"), 150);
    return;
  }

  showPage("startPage");
});


// =====================================================
// 방 만들기
// =====================================================
window.addEventListener("load", () => {
  const makeBtn = document.getElementById("makeRoomBtn");
  if (makeBtn) {
    makeBtn.onclick = () => {
      const id = generateRoomId();
      window.roomId = id;

      socket.emit("joinRoom", { roomId:id, userId:window.userId });
      document.getElementById("roomTitle").innerText = "방번호: " + id;

      showPage("roomPage");
    };
  }

  // 초대 링크 복사
  const copyBtn = document.getElementById("copyInviteBtn");
  if (copyBtn) {
    copyBtn.onclick = () => {
      const url = `${location.origin}/index.html?room=${window.roomId}`;
      navigator.clipboard.writeText(url);
      alert("초대 링크 복사 완료!");
    };
  }

  // READY
  const readyBtn = document.getElementById("readyBtn");
  if (readyBtn) {
    readyBtn.onclick = () => {
      socket.emit("playerReady", {
        roomId:window.roomId,
        userId:window.userId
      });
    };
  }

  // START GAME
  const startGameBtn = document.getElementById("startGameBtn");
  if (startGameBtn) {
    startGameBtn.onclick = () => {
      socket.emit("startGame", {
        roomId:window.roomId,
        userId:window.userId
      });
    };
  }
});


// =====================================================
// 참가자 리스트
// =====================================================
socket.on("playerListUpdate", (players) => {
  window.players = players;
  renderPlayers();
});

function renderPlayers() {
  const box = document.getElementById("playerList");
  if (!box) return;

  box.innerHTML = "";

  for (const uid in window.players) {
    const p = window.players[uid];
    const host = p.isHost ? "👑 " : "";
    const ready = p.ready ? "✔ Ready" : "";
    box.innerHTML += `<div style="margin:6px 0;">${host}${p.nickname} ${ready}</div>`;
  }
}


// =====================================================
// 게임 화면 UI — 핵심 (gameUI.js 역할 포함)
// =====================================================

// 라운드 시작
socket.on("roundStart", ({ round, players, startingPlayer }) => {
  showPage("gamePage");

  document.getElementById("roundInfo").innerText =
    `라운드 ${round} 시작!`;

  window.players = players;

  renderPlayersInGame();
});

// 턴 변경
socket.on("turnChange", (uid) => {
  window.currentTurn = uid;
  renderPlayersInGame();
});

// 손패 업데이트
socket.on("yourHand", (hand) => {
  window.myHand = hand;
  renderHand();
});

// 테이블 업데이트
socket.on("tableUpdate", (cards) => {
  window.tableCards = cards;
  renderTable();
});


// ======================
// 게임 UI 렌더러
// ======================
function renderPlayersInGame() {
  const area = document.getElementById("gamePlayerList");
  if (!area || !window.players) return;

  area.innerHTML = "";

  for (const uid in window.players) {
    const p = window.players[uid];
    const turn = (uid === window.currentTurn) ? "⬅️ 턴" : "";
    const host = p.isHost ? "👑" : "";

    area.innerHTML += `
      <div style="margin:6px 0;">
        ${host} ${p.nickname} ${turn}
      </div>`;
  }
}


// 손패 표시
function renderHand() {
  const area = document.getElementById("handArea");
  if (!area || !window.myHand) return;

  area.innerHTML = "";

  window.myHand.forEach(c => {
    area.innerHTML += `
      <div style="display:inline-block; margin:5px; padding:10px; background:#333; border-radius:8px; color:white;">
        ${c.top} / ${c.bottom}
      </div>`;
  });
}

// 테이블 표시
function renderTable() {
  const area = document.getElementById("tableArea");
  if (!area || !window.tableCards) return;

  area.innerHTML = "";

  window.tableCards.forEach(c => {
    area.innerHTML += `
      <div style="display:inline-block; margin:5px; padding:10px; background:#555; border-radius:8px; color:white;">
        ${c.top} / ${c.bottom}
      </div>`;
  });
}


// =====================================================
// 방 폭파 / 강퇴
// =====================================================
socket.on("roomClosed", () => {
  alert("방장이 나가서 방이 종료되었습니다.");
  showPage("startPage");
});

socket.on("kicked", () => {
  alert("강퇴되었습니다.");
  showPage("startPage");
});


// =====================================================
// 유틸: 방 번호 생성
// =====================================================
function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 6; i++) {
    r += chars[Math.floor(Math.random() * chars.length)];
  }
  return r;
}
