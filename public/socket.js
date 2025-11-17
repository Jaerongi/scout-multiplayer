// =====================================================
// GLOBAL SOCKET + PERMANENT UID (재접속 복구)
// =====================================================

// perm UID
if (!localStorage.getItem("scout_uid")) {
  localStorage.setItem("scout_uid", crypto.randomUUID());
}
window.permUid = localStorage.getItem("scout_uid");

// SOCKET INIT
window.socket = io({
  autoConnect: true,
  transports: ["websocket"]
});

// 상태 변수
window.myUid = null;
window.myName = null;
window.roomId = null;

socket.on("connect", () => {
  window.myUid = socket.id;
  console.log("SOCKET CONNECTED:", window.myUid);
});

// 페이지 관리
window.showPage = function(page) {
  document.getElementById("startPage").style.display = "none";
  document.getElementById("roomPage").style.display = "none";
  document.getElementById("gamePage").style.display = "none";
  document.getElementById(page).style.display = "block";
};


// =====================================================
// 방 만들기
// =====================================================
makeRoomBtn.onclick = () => {
  const name = nicknameInput.value.trim();
  if (!name) return alert("닉네임을 입력하세요.");

  const rid = generateRoomId();

  console.log("🟦 방 생성 요청:", rid);

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

    console.log("🟩 초대방 입장:", rid);

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
// playerListUpdate — ★ 유령 플레이어 방지 핵심 ★
// =====================================================
socket.on("playerListUpdate", (data) => {
  const { roomId, players } = data;

  console.log("📡 playerListUpdate:", data);

  window.roomId = roomId;
  window.players = players;

  // ⭐ 아직 내가 room.players에 없다면 → joinRoom이 아직 반영 안됨
  if (!players[window.permUid]) {
    console.warn("⛔ 내 permUid가 players에 아직 없음 → 무시 (유령 방지)");
    return;
  }

  // 내 닉네임 동기화
  window.myName = players[window.permUid].nickname;

  const roomPageVisible =
    document.getElementById("roomPage").style.display === "block";
  const gamePageVisible =
    document.getElementById("gamePage").style.display === "block";

  // ⭐ 최초 진입 시에만 roomPage로 이동
  if (!roomPageVisible && !gamePageVisible) {
    document.getElementById("roomTitle").innerText = `방번호: ${roomId}`;
    showPage("roomPage");
  }

  // 방 UI 렌더
  if (typeof renderRoomPlayers === "function") {
    renderRoomPlayers(players);
  }
});


// =====================================================
// restoreState — 재접속
// =====================================================
socket.on("restoreState", (state) => {
  if (!state) return;

  console.log("🔄 restoreState:", state);

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
// goGamePage
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
