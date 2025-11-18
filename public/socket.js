// =====================================================
// SOCKET.JS FINAL (2025)
// =====================================================

window.userId = localStorage.getItem("scout_userId");
window.roomId = null;

window.socket = io({
  transports: ["websocket"],
  autoConnect: true
});

// 페이지 전환
window.showPage = function(pageId) {
  ["startPage", "roomPage", "gamePage"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  document.getElementById(pageId).style.display = "block";
};

// CONNECT → 초대링크 or 일반 입장
socket.on("connect", () => {
  const params = new URLSearchParams(location.search);
  const inviteRoom = params.get("room");

  if (!window.userId) {
    location.href = "/login.html";
    return;
  }

  // 초대링크
  if (inviteRoom) {
    window.roomId = inviteRoom;

    socket.emit("joinRoom", {
      roomId: inviteRoom,
      userId: window.userId
    });

    return;
  }

  showPage("startPage");
});

// 방 만들기 버튼
window.addEventListener("load", () => {
  const makeBtn = document.getElementById("makeRoomBtn");
  console.log("gameUI.js LOADED");
  if (makeBtn) {
    makeBtn.onclick = () => {
      const id = generateRoomId();
      window.roomId = id;

      socket.emit("joinRoom", {
        roomId: id,
        userId: window.userId
      });
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

// 대기실 업데이트
let firstJoinCompleted = false;

socket.on("playerListUpdate", (players) => {
  console.log("gameUI.js LOADED");
  window.players = players;

  // roomUI.js 함수명과 정확히 매칭됨
  updateRoomPlayers(players);

  if (!firstJoinCompleted && window.roomId) {
    firstJoinCompleted = true;

    const title = document.getElementById("roomTitle");
    if (title) title.innerText = `방번호: ${window.roomId}`;

    showPage("roomPage");
  }
});

// 게임 화면 이동
socket.on("goGamePage", () => {
  showPage("gamePage");
});

// GAME UI INTERFACE
socket.on("yourHand", (hand) => window.renderHand(hand));
socket.on("tableUpdate", (cards) => window.renderTable(cards));
socket.on("turnChange", (uid) => window.updateTurnHighlight(uid));
socket.on("roundStart", (d) => window.startRoundUI(d));
socket.on("roundEnd", (d) => window.showRoundWinner(d));
socket.on("gameOver", (d) => window.showFinalWinner(d));
socket.on("restoreState", (d) => window.restoreGameUI(d));


// 방 폭파 / 강퇴
socket.on("kicked", () => {
  alert("강퇴되었습니다.");
  showPage("startPage");
});

socket.on("roomClosed", () => {
  alert("방장이 나가 방이 종료되었습니다.");
  showPage("startPage");
});

// 방번호 생성
function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random()*chars.length)];
  return r;
}


