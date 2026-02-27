// =====================================================
// GLOBAL SOCKET + PERMANENT UID (초대 링크 입장 시 NEW UID 발급)
// =====================================================

// 기본 permUid (방 만들기 / 일반 입장 시 유지)
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

// 페이지 전환 도우미
window.showPage = function(page) {
  document.getElementById("startPage").style.display = "none";
  document.getElementById("roomPage").style.display = "none";
  document.getElementById("gamePage").style.display = "none";

  document.getElementById(page).style.display = "block";
};

// 게임 화면으로 이동
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

  // 방장은 기존 permUid를 그대로 사용 (복구 가능)
  socket.emit("joinRoom", {
    roomId,
    nickname: myName,
    permUid: window.permUid
  });

  roomTitle.innerText = `방번호: ${roomId}`;
  showPage("roomPage");
};

// =====================================================
// 초대 링크 입장 (여기서 permUid를 새로 만들어야 함!!)
// =====================================================
enterRoomBtn.onclick = () => {
  const link = prompt("초대 링크를 입력하세요:");

  try {
    const url = new URL(link);
    const rid = url.searchParams.get("room");
    const nickname = prompt("닉네임 입력");

    if (!rid || !nickname) return alert("잘못된 링크입니다.");

    // 🔥 초대 링크 입장 시는 '새로운 사용자' → NEW permUid 생성
    window.permUid = crypto.randomUUID();

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

// =====================================================
// 자동 초대 링크 입장 (index.html의 URL 뒤 ?room=XXXX)
// =====================================================
window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const invitedRoom = params.get("room");

  if (invitedRoom) {
    const nickname = prompt("닉네임을 입력하세요:");
    if (!nickname) return alert("닉네임이 필요합니다!");

    roomId = invitedRoom;
    myName = nickname;

    // 🔥 자동 초대 링크 입장도 새로운 permUid 생성
    window.permUid = crypto.randomUUID();

    socket.emit("joinRoom", {
      roomId,
      nickname: myName,
      permUid: window.permUid
    });

    roomTitle.innerText = `방번호: ${roomId}`;
    showPage("roomPage");
  }
});

// =====================================================
// 서버에서 보내주는 복구 상태
// =====================================================
socket.on("restoreState", (state) => {
  if (!state) return;

  console.log("🔄 복구 시작", state);

  showPage("gamePage");

  window.players = state.players;
  window.tableCards = state.table;
  window.myHand = state.hand;
  window.roundInfo.innerText = `라운드 ${state.round}`;

  renderPlayers();
  renderHand();
  renderTable();

  // 턴 복구
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
