// =====================================================
// SOCKET.JS — FINAL VERSION
// (자동 재접속 + 방폭파 처리 + 강퇴 처리)
// =====================================================

// 고정 permUid (재접속도 동일)
if (!localStorage.getItem("scout_uid")) {
  localStorage.setItem("scout_uid", crypto.randomUUID());
}
window.permUid = localStorage.getItem("scout_uid");

window.socket = io({
  autoConnect: true,
  transports: ["websocket"]
});

window.myUid = null;
window.myName = null;
window.roomId = null;

socket.on("connect", () => {
  window.myUid = socket.id;
});

// 페이지 전환
window.showPage = function(page) {
  document.getElementById("startPage").style.display = "none";
  document.getElementById("roomPage").style.display = "none";
  document.getElementById("gamePage").style.display = "none";

  document.getElementById(page).style.display = "block";
};

// ================================
// 자동 재접속
// ================================
window.addEventListener("DOMContentLoaded", () => {
  const savedRoom = localStorage.getItem("scout_room");
  const savedName = localStorage.getItem("scout_name");

  if (savedRoom && savedName) {
    window.roomId = savedRoom;
    window.myName = savedName;

    socket.emit("joinRoom", {
      roomId: savedRoom,
      nickname: savedName,
      permUid: window.permUid,
    });

    roomTitle.innerText = `방번호: ${savedRoom}`;
    showPage("roomPage");
  }
});

// ================================
// 방 만들기
// ================================
makeRoomBtn.onclick = () => {
  const name = nicknameInput.value.trim();
  if (!name) return alert("닉네임을 입력하세요.");

  myName = name;
  roomId = generateRoomId();

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

    window.roomId = rid;
    window.myName = nickname;

    localStorage.setItem("scout_room", rid);
    localStorage.setItem("scout_name", nickname);

    window.permUid = crypto.randomUUID();
    localStorage.setItem("scout_uid", window.permUid);

    socket.emit("joinRoom", {
      roomId: rid,
      nickname,
      permUid: window.permUid
    });

    roomTitle.innerText = `방번호: ${rid}`;
    showPage("roomPage");
  } catch {
    alert("유효하지 않은 링크입니다.");
  }
};

// ================================
// 게임 화면 이동
// ================================
socket.on("goGamePage", () => {
  showPage("gamePage");
});

// ================================
// 복구
// ================================
socket.on("restoreState", (state) => {
  if (!state) return;

  showPage("gamePage");

  window.players = state.players;
  window.tableCards = state.table;
  window.myHand = state.hand;
  window.roundInfo.innerText = `라운드 ${state.round}`;

  renderPlayers();
  renderHand();
  renderTable();

  window.myTurn = (state.turn === window.permUid);
  highlightTurn(state.turn);
  updateActionButtons();
});

// ================================
// 강퇴 처리
// ================================
socket.on("kicked", () => {
  alert("방장에서 강퇴되었습니다.");

  localStorage.removeItem("scout_room");
  localStorage.removeItem("scout_name");

  showPage("startPage");
});

// ================================
// 방 폭파 처리
// ================================
socket.on("roomClosed", () => {
  alert("방장이 나가 방이 종료되었습니다.");

  localStorage.removeItem("scout_room");
  localStorage.removeItem("scout_name");

  showPage("startPage");
});

// ================================
// 방 ID 생성기
// ================================
function generateRoomId() {
  const s = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let r = "";
  for (let i = 0; i < 6; i++) r += s[Math.floor(Math.random() * s.length)];
  return r;
}
