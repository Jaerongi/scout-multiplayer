// =====================================================
// SOCKET.JS — FINAL (2025) 
// login.html 로그인 → index.html 방만들기 → 대기실 UI → 게임 UI (원본 구조 유지)
// =====================================================

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

  // 로그인 확인
  if (!window.userId) {
    location.href = "/login.html";
    return;
  }

  // 초대링크로 접근했을 경우
  if (inviteRoom) {
    window.roomId = inviteRoom;

    socket.emit("joinRoom", {
      roomId: inviteRoom,
      userId: window.userId
    });

    // playerListUpdate가 올 때 방 화면 전환
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

      // playerListUpdate가 올 때 자동으로 roomPage로 전환됨
    };
  }

  // 초대링크 복사
  const copyBtn = document.getElementById("copyInviteBtn");
  if (copyBtn) {
    copyBtn.onclick = () => {
      const url = `${location.origin}/index.html?room=${window.roomId}`;
      navigator.clipboard.writeText(url);
      alert("초대 링크가 복사되었습니다.");
    };
  }

  // READY 버튼
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
// 3) playerListUpdate — 대기실 UI 업데이트 + 최초 입장 처리
// ======================================================
let firstJoinCompleted = false;

socket.on("playerListUpdate", (players) => {
  window.players = players;
  renderPlayers(); // roomUI.js에서 구현됨

  // 최초 입장 시 방 화면 전환
  if (!firstJoinCompleted && window.roomId) {
    firstJoinCompleted = true;

    const title = document.getElementById("roomTitle");
    if (title) title.innerText = `방번호: ${window.roomId}`;

    showPage("roomPage");
  }
});


// ======================================================
// 4) 게임 시작 화면 이동
// ======================================================
socket.on("goGamePage", () => {
  showPage("gamePage");
});


// ======================================================
// 5) 게임 UI 업데이트 (기존 gameUI.js 그대로 사용)
// ======================================================
socket.on("yourHand", (hand) => {
  renderHand(hand);  // gameUI.js의 함수
});

socket.on("tableUpdate", (cards) => {
  renderTable(cards);  // gameUI.js의 함수
});

socket.on("turnChange", (uid) => {
  updateTurnHighlight(uid); // gameUI.js의 함수
});

socket.on("roundStart", (data) => {
  startRoundUI(data); // gameUI.js의 함수
});

socket.on("roundEnd", (data) => {
  showRoundWinner(data); // gameUI.js 함수
});

socket.on("gameOver", (data) => {
  showFinalWinner(data); // gameUI.js 함수
});

socket.on("restoreState", (data) => {
  restoreGameUI(data); // gameUI.js 함수
});


// ======================================================
// 6) 강퇴 / 방폭파
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
// 7) 방번호 생성기
// ======================================================
function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}
