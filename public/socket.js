// =====================================================
// GLOBAL SOCKET + PERMANENT UID + 자동 재접속 기능
// =====================================================

// 🔥 1) 고정 permUid 생성 (재접속해도 동일)
if (!localStorage.getItem("scout_uid")) {
  localStorage.setItem("scout_uid", crypto.randomUUID());
}
window.permUid = localStorage.getItem("scout_uid");

// SOCKET
window.socket = io({
  autoConnect: true,
  transports: ["websocket"]
});

window.myUid = null;
window.myName = null;
window.roomId = null;

// 연결
socket.on("connect", () => {
  window.myUid = socket.id;
  console.log("SOCKET CONNECTED:", myUid);
});

// 페이지 전환
window.showPage = function(page) {
  document.getElementById("startPage").style.display = "none";
  document.getElementById("roomPage").style.display = "none";
  document.getElementById("gamePage").style.display = "none";

  document.getElementById(page).style.display = "block";
};

// ===============================
// 🔥 2) 새로고침 후 자동 재입장 기능
// ===============================
window.addEventListener("DOMContentLoaded", () => {
  const savedRoom = localStorage.getItem("scout_room");
  const savedName = localStorage.getItem("scout_name");

  if (savedRoom && savedName) {
    console.log("🔄 자동 재접속 중…");

    window.roomId = savedRoom;
    window.myName = savedName;

    // 방 재입장
    socket.emit("joinRoom", {
      roomId: savedRoom,
      nickname: savedName,
      permUid: window.permUid
    });

    roomTitle.innerText = `방번호: ${savedRoom}`;
    showPage("roomPage");
  }
});

// 게임 화면 이동
socket.on("goGamePage", () => {
  showPage("gamePage");
});

// =====================================================
// 방 만들기
// =====================================================
makeRoomBtn.onclick = () => {
  const name = nicknameInput.value.trim();
  if (!name) return alert("닉네임을 입력하세요.");

  myName = name;
  roomId = generateRoomId();

  // 🔥 저장 (재접속 가능)
  localStorage.setItem("scout_room", roomId);
  localStorage.setItem("scout_name", myName);

  socket.emit("joinRoom", {
    roomId,
    nickname: myName,
    permUid: window.permUid
  });

  roomTitle.innerText = `방번호: ${roomId}`;
  showPage("roomPage");
};

// =====================================================
// 초대 링크 입장
// =====================================================
enterRoomBtn.onclick = () => {
  const link = prompt("초대 링크를 입력하세요:");

  try {
    const url = new URL(link);
    const rid = url.searchParams.get("room");
    const nickname = prompt("닉네임 입력");

    if (!rid || !nickname) return alert("잘못된 링크입니다.");

    // 🔥 저장해서 재입장 가능
    window.roomId = rid;
    window.myName = nickname;

    localStorage.setItem("scout_room", rid);
    localStorage.setItem("scout_name", nickname);

    // 초대 입장은 새로운 permUid (원래 룰 유지)
    window.permUid = crypto.randomUUID();
    localStorage.setItem("scout_uid", window.permUid);

    socket.emit("joinRoom", {
      roomId: rid,
      nickname: nickname,
      permUid: window.permUid
    });

    roomTitle.innerText = `방번호: ${rid}`;
    showPage("roomPage");
  } catch {
    alert("유효하지 않은 링크입니다.");
  }
};

// =====================================================
// 자동 초대 링크 (?room=XXXX) 입장
// =====================================================
window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const invitedRoom = params.get("room");

  if (invitedRoom) {
    const nickname = prompt("닉네임을 입력하세요:");
    if (!nickname) return alert("닉네임이 필요합니다!");

    window.roomId = invitedRoom;
    window.myName = nickname;

    // 🔥 저장 (자동 재접속 가능)
    localStorage.setItem("scout_room", invitedRoom);
    localStorage.setItem("scout_name", nickname);

    // 초대 링크는 새 permUid
    window.permUid = crypto.randomUUID();
    localStorage.setItem("scout_uid", window.permUid);

    socket.emit("joinRoom", {
      roomId: invitedRoom,
      nickname: nickname,
      permUid: window.permUid
    });

    roomTitle.innerText = `방번호: ${invitedRoom}`;
    showPage("roomPage");
  }
});

// =====================================================
// 복구 기능
// =====================================================
socket.on("restoreState", (state) => {
  if (!state) return;

  console.log("🔄 복구 시작", state);

  showPage("gamePage");

  window.players = state.players;
  window.tableCards = state.table;
  window.myHand = state.hand;
  window.roundInfo.innerText = `라운드 ${state.round}`;

  // 렌더링 함수는 gameUI.js에 있음
  renderPlayers();
  renderHand();
  renderTable();

  window.myTurn = (state.turn === window.permUid);
  highlightTurn(state.turn);
  updateActionButtons();
});

// =====================================================
// 방 ID 생성기
// =====================================================
function generateRoomId() {
  const s = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let r = "";
  for (let i = 0; i < 6; i++) r += s[Math.floor(Math.random() * s.length)];
  return r;
}
