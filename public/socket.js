// =====================================================
// SOCKET.JS — 회원 기반 + 자동재접속 + 초대링크 입장 + 로그아웃
// =====================================================

// 현재 로그인된 userId
window.userId = localStorage.getItem("scout_userId") || null;

// 로그인되어 있지 않으면 login.html로 이동
if (!window.userId) {
  location.href = "/login.html";
}

// 전역 변수
window.socket = io({
  autoConnect: true,
  transports: ["websocket"]
});

window.roomId = null;


// ------------------------------------------------------
// 페이지 전환 함수
// ------------------------------------------------------
window.showPage = function (page) {
  ["startPage", "roomPage", "gamePage"].forEach(id => {
    document.getElementById(id).style.display = "none";
  });
  document.getElementById(page).style.display = "block";
};


// ======================================================
// SOCKET CONNECTED
// (초대링크 처리 + 자동 재입장)
// ======================================================
socket.on("connect", () => {

  // 초대 링크 ?room=XXXX 처리
  const params = new URLSearchParams(location.search);
  const rid = params.get("room");

  if (rid && window.userId) {
    window.roomId = rid;

    socket.emit("joinRoom", {
      roomId: rid,
      userId: window.userId
    });

    // UI 갱신
    const title = document.getElementById("roomTitle");
    if (title) title.innerText = `방번호: ${rid}`;

    showPage("roomPage");
    return;
  }

  // 기본 화면
  showPage("startPage");
});


// ======================================================
// 방 만들기
// ======================================================
makeRoomBtn.onclick = () => {
  roomId = generateRoomId();

  socket.emit("joinRoom", {
    roomId,
    userId: window.userId
  });

  roomTitle.innerText = `방번호: ${roomId}`;
  showPage("roomPage");
};


// ======================================================
// 초대 링크 직접 입력하여 입장
// ======================================================
enterRoomBtn.onclick = () => {
  const link = prompt("초대 링크를 입력하세요:");

  try {
    const url = new URL(link);
    const rid = url.searchParams.get("room");

    if (!rid) return alert("잘못된 링크입니다.");

    window.roomId = rid;

    socket.emit("joinRoom", {
      roomId: rid,
      userId: window.userId
    });

    roomTitle.innerText = `방번호: ${rid}`;
    showPage("roomPage");

  } catch {
    alert("유효하지 않은 링크입니다.");
  }
};


// ======================================================
// 서버에서 게임 화면으로 이동 신호
// ======================================================
socket.on("goGamePage", () => {
  showPage("gamePage");
});


// ======================================================
// 강퇴 처리
// ======================================================
socket.on("kicked", () => {
  alert("방장에서 강퇴되었습니다.");
  showPage("startPage");
});


// ======================================================
// 방 폭파
// ======================================================
socket.on("roomClosed", () => {
  alert("방장이 나가서 게임방이 종료되었습니다.");
  showPage("startPage");
});


// ======================================================
// 상태 복구 (재접속)
// ======================================================
socket.on("restoreState", (state) => {
  showPage("gamePage");

  window.players = state.players;
  window.tableCards = state.table;
  window.myHand = state.hand;

  roundInfo.innerText = `라운드 ${state.round}`;

  renderPlayers();
  renderHand();
  renderTable();

  window.myTurn = (state.turn === window.userId);
  highlightTurn(state.turn);
  updateActionButtons();
});


// ======================================================
// 로그아웃 기능
// ======================================================
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.onclick = () => {
    if (confirm("로그아웃하시겠습니까?")) {
      localStorage.removeItem("scout_userId");
      location.href = "/login.html";
    }
  };
}


// ======================================================
// 방 번호 자동 생성
// ======================================================
function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 6; i++) {
    r += chars[Math.floor(Math.random() * chars.length)];
  }
  return r;
}
