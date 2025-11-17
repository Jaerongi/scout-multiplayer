// =====================================================
// GLOBAL SOCKET + PERMANENT UID (재접속 복구 모드)
// =====================================================

// 브라우저 영구 UID
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
window.myName = null;   // ⚠️ 서버에서 받은 닉네임으로만 설정함
window.roomId = null;   // ⚠️ UI에서 직접 세팅하지 않음

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

// =====================================================
// 방 생성
// =====================================================
makeRoomBtn.onclick = () => {
  const name = nicknameInput.value.trim();
  if (!name) return alert("닉네임을 입력하세요.");

  // 👉 UI에서 roomId/myName 직접 저장하지 않는다!
  const rid = generateRoomId();

  socket.emit("joinRoom", {
    roomId: rid,
    nickname: name,
    permUid: window.permUid
  });
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

    // 👉 여기서도 직접 roomId/myName 저장 안 함
    socket.emit("joinRoom", {
      roomId: rid,
      nickname,
      permUid: window.permUid
    });

  } catch {
    alert("유효하지 않은 링크입니다.");
  }
};

// =====================================================
// 서버가 joinRoom 후 상태를 브로드캐스트하면
// 이 클라이언트도 playerListUpdate를 통해 자신 정보 확인
// =====================================================
socket.on("playerListUpdate", (players) => {
  console.log("playerListUpdate", players);

  window.players = players;

  // 내 정보 찾기
  for (const uid in players) {
    if (players[uid].uid === window.permUid) {
      window.myName = players[uid].nickname;
      break;
    }
  }

  // ⭐ 방에 처음 들어온 경우 (= 방장) 자동으로 roomId를 세팅하고 화면 이동
  if (!window.roomId) {
    // 서버가 roomId를 같이 보내도록 server.js에서 수정했으면 data.roomId로 바로 들어옴
    // 지금 구조에서는 joinRoom 요청에 사용한 roomId 그대로 socket.rooms로 확인 가능
    // 방 아이디를 서버가 직접 보내는 방식이 더 안전함

    // 안전하게 server.js에서 goGamePage나 roundStart 때 roomId 제공하도록 해야함.
    // 여기서는 간단히: 방장이 첫 번 호출 시 roomPage 이동
    window.roomId = Object.keys(socket.rooms).find(r => r !== socket.id);

    if (!window.roomId) return; // 방 정보 아직 없음

    // ⭐ 방장: 방 생성 즉시 roomPage로 이동
    document.getElementById("roomTitle").innerText = `방번호: ${window.roomId}`;
    showPage("roomPage");
  }
});


// =====================================================
// 서버에서 복구 상태 제공
// =====================================================
socket.on("restoreState", (state) => {
  if (!state) return;

  // 복구된 roomId
  window.roomId = state.roomId ?? window.roomId;

  showPage("gamePage");

  window.players = state.players;
  window.tableCards = state.table;
  window.myHand = state.hand;
  roundInfo.innerText = `라운드 ${state.round}`;

  renderPlayers();
  renderHand();
  renderTable();

  window.myTurn = (state.turn === window.permUid);
  highlightTurn(state.turn);
  updateActionButtons();
});

// =====================================================
// 서버가 "goGamePage" 보낼 때 roomId 전달되도록 server.js 수정됨
// =====================================================
socket.on("goGamePage", (data) => {
  if (data?.roomId) window.roomId = data.roomId;
  showPage("gamePage");
});

// =====================================================
// 방 ID 생성
// =====================================================
function generateRoomId() {
  const s = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let r = "";
  for (let i = 0; i < 6; i++) r += s[Math.floor(Math.random() * s.length)];
  return r;
}

