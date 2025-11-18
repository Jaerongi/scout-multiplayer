// =====================================================
// socket.js — GLOBAL VERSION (2025.11 통합 안정판)
// =====================================================

// 영구 UID 발급
if (!localStorage.getItem("scout_uid")) {
  localStorage.setItem("scout_uid", crypto.randomUUID());
}
window.permUid = localStorage.getItem("scout_uid");

// SOCKET 연결
window.socket = io({
  autoConnect: true,
  transports: ["websocket"]
});

window.myUid = null;
window.myName = null;
window.roomId = null;
window.players = {};        // 현재 방의 플레이어 상태
window.myHand = [];
window.tableCards = [];

socket.on("connect", () => {
  window.myUid = socket.id;
  console.log("SOCKET CONNECTED:", window.myUid);
});

// 페이지 전환 함수
window.showPage = function (page) {
  document.getElementById("startPage").style.display = "none";
  document.getElementById("roomPage").style.display = "none";
  document.getElementById("gamePage").style.display = "none";

  document.getElementById(page).style.display = "block";
};


// =====================================================
// 방 생성
// =====================================================
makeRoomBtn.onclick = () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) return alert("닉네임을 입력하세요.");

  const rid = generateRoomId();

  console.log("🟦 방 생성:", rid);

  socket.emit("joinRoom", {
    roomId: rid,
    nickname,
    permUid: window.permUid
  });
};


// =====================================================
// 초대 링크 입장
// =====================================================
enterRoomBtn.onclick = () => {
  const link = prompt("초대 링크를 입력하세요:");
  if (!link) return;

  try {
    const url = new URL(link);
    const rid = url.searchParams.get("room");
    const nickname = prompt("닉네임 입력");

    if (!rid || !nickname) return alert("잘못된 링크입니다.");

    console.log("🟩 초대 입장:", rid);

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
// playerListUpdate — 방 UI 핵심
// =====================================================
socket.on("playerListUpdate", (data) => {
  const { roomId, players } = data;

  console.log("📡 playerListUpdate:", data);

  window.roomId = roomId;
  window.players = players;

  // 🔥 내가 아직 players에 없다면 = joinRoom 미완료 → 무시
  if (!players[window.permUid]) {
    console.warn("⛔ joinRoom 미완료 → playerListUpdate 무시");
    return;
  }

  // 내 정보 세팅
  window.myName = players[window.permUid].nickname;

  // 처음 진입 시 roomPage로 이동
  const roomPageVisible =
    document.getElementById("roomPage").style.display === "block";
  const gamePageVisible =
    document.getElementById("gamePage").style.display === "block";

  if (!roomPageVisible && !gamePageVisible) {
    document.getElementById("roomTitle").innerText = `방번호: ${roomId}`;
    showPage("roomPage");
  }

  // 방 UI 렌더링
  if (typeof window.renderRoomPlayers === "function") {
    window.renderRoomPlayers(players);
  }
});


// =====================================================
// 게임 시작
// =====================================================
socket.on("goGamePage", (data) => {
  if (data?.roomId) window.roomId = data.roomId;
  showPage("gamePage");
});


// =====================================================
// HAND 업데이트
// =====================================================
socket.on("yourHand", (hand) => {
  window.myHand = hand;
  if (typeof window.renderHand === "function") {
    window.renderHand();
  }
});


// =====================================================
// TABLE 업데이트
// =====================================================
socket.on("tableUpdate", (table) => {
  window.tableCards = table;
  if (typeof window.renderTable === "function") {
    window.renderTable();
  }
});


// =====================================================
// ROUND 시작
// =====================================================
socket.on("roundStart", (data) => {
  const { round } = data;
  roundInfo.innerText = `라운드 ${round}`;

  if (typeof window.renderPlayers === "function") {
    window.renderPlayers();
  }
});


// =====================================================
// 턴 변경
// =====================================================
socket.on("turnChange", (turnUid) => {
  window.myTurn = (turnUid === window.permUid);

  if (typeof window.highlightTurn === "function") {
    window.highlightTurn(turnUid);
  }

  if (typeof window.updateActionButtons === "function") {
    window.updateActionButtons();
  }
});


// =====================================================
// 재접속 복구
// =====================================================
socket.on("restoreState", (state) => {
  console.log("🔄 restoreState:", state);

  window.roomId = state.roomId;
  window.players = state.players;
  window.tableCards = state.table;
  window.myHand = state.hand;

  showPage("gamePage");

  roundInfo.innerText = `라운드 ${state.round}`;

  if (typeof window.renderPlayers === "function") renderPlayers();
  if (typeof window.renderHand === "function") renderHand();
  if (typeof window.renderTable === "function") renderTable();

  window.myTurn = (state.turn === window.permUid);
  if (typeof window.highlightTurn === "function") highlightTurn(state.turn);
  if (typeof window.updateActionButtons === "function") updateActionButtons();
});


// =====================================================
// 방 ID 생성
// =====================================================
function generateRoomId() {
  const s = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let r = "";
  for (let i = 0; i < 6; i++) {
    r += s[Math.floor(Math.random() * s.length)];
  }
  return r;
}

console.log("socket.js loaded (GLOBAL VERSION)");
