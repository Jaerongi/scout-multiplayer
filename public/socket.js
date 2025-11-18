// =====================================================
// SOCKET.JS — 로그인 기반 / 방 만들기 / 초대 링크 자동입장 / 재접속 복구
// =====================================================

// 로그인한 사용자 ID 체크
window.userId = localStorage.getItem("scout_userId");

// 로그인 안 되어 있으면 login.html 이동
if (!window.userId) {
  location.href = "/login.html";
}

// 소켓 연결
window.socket = io({
  transports: ["websocket"],
  autoConnect: true
});

// 전역 변수
window.roomId = null;


// ------------------------------------------------------
// 페이지 전환 함수
// ------------------------------------------------------
window.showPage = function (page) {
  ["startPage", "roomPage", "gamePage"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  const pg = document.getElementById(page);
  if (pg) pg.style.display = "block";
};


// ======================================================
// SOCKET CONNECTED — (초대 링크 로그인 후 자동 입장)
// ======================================================
socket.on("connect", () => {

  const params = new URLSearchParams(location.search);
  const rid = params.get("room");

  // 초대 링크로 들어온 경우
  if (rid) {
    window.roomId = rid;

    socket.emit("joinRoom", {
      roomId: rid,
      userId: window.userId
    });

    const title = document.getElementById("roomTitle");
    if (title) title.innerText = `방번호: ${rid}`;

    showPage("roomPage");
    return;
  }

  // 기본 화면 (index.html)
  showPage("startPage");
});



// ======================================================
// (중요!) DOM 로드 후 방 만들기 버튼 이벤트 연결
// ======================================================
window.addEventListener("load", () => {
  const btn = document.getElementById("makeRoomBtn");
  if (!btn) return;

  btn.onclick = () => {
    const id = generateRoomId();
    window.roomId = id;

    socket.emit("joinRoom", {
      roomId: id,
      userId: window.userId
    });

    const title = document.getElementById("roomTitle");
    if (title) title.innerText = `방번호: ${id}`;

    showPage("roomPage");
  };
});



// ======================================================
// 서버에서 게임 시작 신호
// ======================================================
socket.on("goGamePage", () => {
  showPage("gamePage");
});


// ======================================================
// 방 폭파
// ======================================================
socket.on("roomClosed", () => {
  alert("방장이 나가서 방이 종료되었습니다.");
  showPage("startPage");
});


// ======================================================
// 강퇴 처리
// ======================================================
socket.on("kicked", () => {
  alert("강퇴되었습니다.");
  showPage("startPage");
});


// ======================================================
// 재접속 복구
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

  // 내 턴 여부
  window.myTurn = (state.turn === window.userId);
  highlightTurn(state.turn);
  updateActionButtons();
});


// ======================================================
// 플레이어 목록 갱신
// ======================================================
socket.on("playerListUpdate", (players) => {
  window.players = players;
  renderPlayers();
});


// ======================================================
// 테이블 업데이트
// ======================================================
socket.on("tableUpdate", (cards) => {
  window.tableCards = cards;
  renderTable();
});


// ======================================================
// 턴 변경
// ======================================================
socket.on("turnChange", (uid) => {
  window.myTurn = (uid === window.userId);
  highlightTurn(uid);
  updateActionButtons();
});


// ======================================================
// 라운드 / 게임 이벤트
// ======================================================
socket.on("roundStart", (data) => {
  showPage("gamePage");
  roundInfo.innerText = `라운드 ${data.round}`;
  renderPlayers();
  renderHand();
  renderTable();
});

socket.on("roundEnd", (data) => {
  const winner = window.players[data.winner].nickname;
  alert(`라운드 종료!\n승자: ${winner}`);
});

socket.on("gameOver", (data) => {
  const winner = window.players[data.winner].nickname;
  alert(`🎉 게임 종료!\n최종 우승자: ${winner}`);
});


// ======================================================
// 방 번호 생성기
// ======================================================
function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 6; i++) {
    r += chars[Math.floor(Math.random() * chars.length)];
  }
  return r;
}
