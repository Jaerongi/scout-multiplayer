// =====================================================
// SOCKET.JS — FINAL (2025 안정화)
// login.html 로그인 → index.html 방만들기 → 대기실 → 기존 게임UI 그대로 작동
// =====================================================

// 로그인 정보
window.userId = localStorage.getItem("scout_userId");
window.roomId = null;

// 소켓 연결
window.socket = io({
  transports: ["websocket"],
  autoConnect: true
});

// ------------------------------------------------------
// 페이지 전환 공용 함수
// ------------------------------------------------------
window.showPage = function(pageId) {
  ["startPage", "roomPage", "gamePage"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  document.getElementById(pageId).style.display = "block";
};


// ======================================================
// 1) 소켓 connect 후 초대 링크 처리
// ======================================================
socket.on("connect", () => {
  const params = new URLSearchParams(location.search);
  const inviteRoom = params.get("room");

  // 로그인 안 되어있으면 로그인 페이지로
  if (!window.userId) {
    location.href = "/login.html";
    return;
  }

  // 초대 링크로 들어왔을 때
  if (inviteRoom) {
    window.roomId = inviteRoom;

    socket.emit("joinRoom", {
      roomId: inviteRoom,
      userId: window.userId
    });

    // playerListUpdate가 오면 자동 방 입장 처리됨
    return;
  }

  // 일반 접속이면 startPage
  showPage("startPage");
});


// ======================================================
// 2) 방 만들기 버튼
// ======================================================
window.addEventListener("load", () => {
  const makeBtn = document.getElementById("makeRoomBtn");

  if (makeBtn) {
    makeBtn.onclick = () => {
      const id = generateRoomId();
      window.roomId = id;

      socket.emit("joinRoom", {
        roomId: id,
        userId: window.userId
      });

      // 이제는 playerListUpdate가 오면 roomPage로 자동 이동
    };
  }

  // 초대링크 복사 버튼
  const copyBtn = document.getElementById("copyInviteBtn");
  if (copyBtn) {
    copyBtn.onclick = () => {
      const url = `${location.origin}/index.html?room=${window.roomId}`;
      navigator.clipboard.writeText(url);
      alert("초대 링크가 복사되었습니다!");
    };
  }

  // READY
  const readyBtn = document.getElementById("readyBtn");
  if (readyBtn) {
    readyBtn.onclick = () => {
      socket.emit("playerReady", {
        roomId: window.roomId,
        userId: window.userId
      });
    };
  }

  // START GAME
  const startBtn = document.getElementById("startGameBtn");
  if (startBtn) {
    startBtn.onclick = () => {
      socket.emit("startGame", {
        roomId: window.roomId,
        userId: window.userId
      });
    };
  }
});


// ======================================================
// 3) playerListUpdate — 대기실 UI + 자동 입장 처리
// ======================================================
let firstJoinCompleted = false;

socket.on("playerListUpdate", (players) => {
  window.players = players;

  // 🔥 roomUI.js 의 함수 이름과 맞춤 (renderPlayers → updateRoomPlayers)
  updateRoomPlayers(players);  

  // 방 처음 입장 시 들어가기
  if (!firstJoinCompleted && window.roomId) {
    firstJoinCompleted = true;

    const title = document.getElementById("roomTitle");
    if (title) title.innerText = `방번호: ${window.roomId}`;

    showPage("roomPage");
  }
});


// ======================================================
// 4) 게임 페이지 이동 (UI 원본 유지용)
// ======================================================
socket.on("goGamePage", () => {
  showPage("gamePage");
});


// ======================================================
// 5) 게임 UI 업데이트 (gameUI.js에 구현됨)
// ======================================================
socket.on("yourHand", (hand) => {
  renderHand(hand);
});

socket.on("tableUpdate", (cards) => {
  renderTable(cards);
});

socket.on("turnChange", (uid) => {
  updateTurnHighlight(uid);
});

socket.on("roundStart", (data) => {
  startRoundUI(data);
});

socket.on("roundEnd", (data) => {
  showRoundWinner(data);
});

socket.on("gameOver", (data) => {
  showFinalWinner(data);
});

socket.on("restoreState", (data) => {
  restoreGameUI(data);
});


// ======================================================
// 6) 방 폭파 / 강퇴
// ======================================================
socket.on("kicked", () => {
  alert("강퇴되었습니다.");
  showPage("startPage");
});

socket.on("roomClosed", () => {
  alert("방장이 나가 방이 종료되었습니다.");
  showPage("startPage");
});


// ======================================================
// 7) 방 번호 생성
// ======================================================
function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 6; i++) {
    r += chars[Math.floor(Math.random() * chars.length)];
  }
  return r;
}
