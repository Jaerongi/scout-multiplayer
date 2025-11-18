// =====================================================
// SOCKET.JS — 로그인 기반 멀티플레이 + 자동재접속
// =====================================================

window.socket = io({
  autoConnect:true,
  transports:["websocket"]
});

window.roomId = null;
window.userId = localStorage.getItem("scout_userId") || null;

// 페이지 전환
window.showPage = function(page) {
  document.getElementById("startPage").style.display = "none";
  document.getElementById("roomPage").style.display = "none";
  document.getElementById("gamePage").style.display = "none";
  document.getElementById(page).style.display = "block";
};

// ------------------------------------------------------
// 로그인 여부 체크 → 로그인 안되면 login.html로 이동
// ------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  if (!window.userId) {
    location.href = "/login.html";
    return;
  }

  showPage("startPage");

  // 방 자동 복구는 없음(로그인 단위로만 진행)
});

// ------------------------------------------------------
// 방 만들기
// ------------------------------------------------------
makeRoomBtn.onclick = () => {
  roomId = generateRoomId();

  socket.emit("joinRoom", {
    roomId,
    userId: window.userId
  });

  roomTitle.innerText = `방번호: ${roomId}`;
  showPage("roomPage");
};

// ------------------------------------------------------
// 초대 링크로 입장
// ------------------------------------------------------
enterRoomBtn.onclick = () => {
  const link = prompt("초대 링크를 입력하세요:");

  try {
    const url = new URL(link);
    const rid = url.searchParams.get("room");

    if (!rid) return alert("잘못된 링크입니다.");

    roomId = rid;

    socket.emit("joinRoom", {
      roomId,
      userId: window.userId
    });

    roomTitle.innerText = `방번호: ${roomId}`;
    showPage("roomPage");

  } catch {
    alert("유효하지 않은 링크입니다.");
  }
};

// ------------------------------------------------------
// 초대 링크 자동 입장 (?room=xxxx)
// ------------------------------------------------------
(function(){
  const params = new URLSearchParams(location.search);
  const rid = params.get("room");

  if (rid && window.userId) {
    roomId = rid;

    socket.emit("joinRoom", {
      roomId,
      userId: window.userId
    });

    roomTitle.innerText = `방번호: ${roomId}`;
    showPage("roomPage");
  }
})();

// ------------------------------------------------------
// 게임 화면 이동
// ------------------------------------------------------
socket.on("goGamePage", () => showPage("gamePage"));

// ------------------------------------------------------
// 강퇴 처리
// ------------------------------------------------------
socket.on("kicked", () => {
  alert("방장에서 강퇴되었습니다.");
  showPage("startPage");
});

// ------------------------------------------------------
// 방 폭파 처리
// ------------------------------------------------------
socket.on("roomClosed", () => {
  alert("방장이 나가 게임방이 종료되었습니다.");
  showPage("startPage");
});

// ------------------------------------------------------
// 복구
// ------------------------------------------------------
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

// ------------------------------------------------------
// ID 생성
// ------------------------------------------------------
function generateRoomId() {
  const s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i=0; i<6; i++) r += s[Math.floor(Math.random()*s.length)];
  return r;
}
// ===============================
// 로그아웃
// ===============================
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.onclick = () => {
    if (confirm("로그아웃하시겠습니까?")) {
      localStorage.removeItem("scout_userId");
      location.href = "/login.html";
    }
  };
}

