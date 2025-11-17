// =====================================================
// GLOBAL SOCKET + PERMANENT UID (재접속 복구 모드)
// =====================================================

// 브라우저에 영구 UID 저장
if (!localStorage.getItem("scout_uid")) {
  localStorage.setItem("scout_uid", crypto.randomUUID());
}
window.permUid = localStorage.getItem("scout_uid");

// SOCKET
window.socket = io({
  autoConnect: true,
  transports: ["websocket"]
});

window.myUid = null;       // socket.id
window.myName = null;
window.roomId = null;

socket.on("connect", () => {
  window.myUid = socket.id;
  console.log("SOCKET CONNECTED:", myUid);
});

// 페이지 스위치
window.showPage = function(page) {
  document.getElementById("startPage").style.display = "none";
  document.getElementById("roomPage").style.display = "none";
  document.getElementById("gamePage").style.display = "none";

  document.getElementById(page).style.display = "block";
};

// 게임 화면 이동
socket.on("goGamePage", () => {
  showPage("gamePage");
});

// ================================
// 방 생성
// ================================
makeRoomBtn.onclick = () => {
  const name = nicknameInput.value.trim();
  if (!name) return alert("닉네임을 입력하세요.");

  myName = name;
  roomId = generateRoomId();

  socket.emit("joinRoom", {
    roomId,
    nickname: myName,
    permUid: window.permUid
  });

  roomTitle.innerText = `방번호: ${roomId}`;
  showPage("roomPage");
};

// ================================
// 초대 링크 입장
// ================================
enterRoomBtn.onclick = () => {
  const link = prompt("초대 링크를 입력하세요:");

  try {
    const url = new URL(link);
    const rid = url.searchParams.get("room");
    const nickname = prompt("닉네임 입력");

    if (!rid || !nickname) return alert("잘못된 링크입니다.");

    roomId = rid;
    myName = nickname;

    socket.emit("joinRoom", {
      roomId,
      nickname: myName,
      permUid: window.permUid
    });

    roomTitle.innerText = `방번호: ${roomId}`;
    showPage("roomPage");
  } catch {
    alert("유효하지 않은 링크입니다.");
  }
};

// ================================
// 서버가 보내주는 복구 상태
// ================================
socket.on("restoreState", (state) => {
  if (!state) return;

  console.log("🔄 복구 시작", state);

  // 게임 페이지로 이동
  showPage("gamePage");

  // 복구
  window.players = state.players;
  window.tableCards = state.table;
  window.myHand = state.hand;
  window.roundInfo.innerText = `라운드 ${state.round}`;
  
  renderPlayers();
  renderHand();
  renderTable();

  // 턴 복구
  window.myTurn = (state.turn === myUid);
  highlightTurn(state.turn);
  updateActionButtons();
});

// ================================
// 방 ID 생성
// ================================
function generateRoomId() {
  const s = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let r = "";
  for (let i = 0; i < 6; i++) r += s[Math.floor(Math.random() * s.length)];
  return r;
}
