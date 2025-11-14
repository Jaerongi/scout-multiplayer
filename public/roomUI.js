// ==========================================
// SCOUT – ROOM PAGE LOGIC (대기실 UI)
// ==========================================

// 🔥 socket.js에서 전역(window)에 등록된 socket을 가져옴
const socket = window.socket;

// 🔥 전역 변수 접근용 (window.myXXX 사용)
function myUid()   { return window.myUid; }
function myName()  { return window.myName; }
function roomId()  { return window.roomId; }

// DOM
const playerListDiv = document.getElementById("playerList");
const readyBtn       = document.getElementById("readyBtn");
const startGameBtn   = document.getElementById("startGameBtn");
const copyInviteBtn  = document.getElementById("copyInviteBtn");

let players = {};


// ==========================================
// 플레이어 목록 업데이트
// ==========================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
  updateStartButtonState();
});


// ==========================================
// READY 버튼
// ==========================================
readyBtn.onclick = () => {
  socket.emit("playerReady", { roomId: roomId() });
};


// ==========================================
// 게임 시작 (방장만 가능)
// ==========================================
startGameBtn.onclick = () => {
  socket.emit("forceStartGame", { roomId: roomId() });

  // 게임 페이지로 이동
  window.showPage("gamePage");
};


// ==========================================
// 초대 링크 복사
// ==========================================
copyInviteBtn.onclick = () => {
  const link = `${location.origin}/index.html?room=${roomId()}`;
  navigator.clipboard.writeText(link);
  alert("초대 링크가 복사되었습니다!\n" + link);
};


// ==========================================
// UI 렌더링
// ==========================================
function renderPlayerList() {
  playerListDiv.innerHTML = "";

  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox";

    let readyTxt = p.ready ? "🟢 READY" : "⚪ 대기";

    div.innerHTML = `
      <b>${p.nickname}</b>
      <div>${readyTxt}</div>
    `;

    playerListDiv.appendChild(div);
  });
}


// ==========================================
// 스타트 버튼 활성화/비활성화
// ==========================================
function updateStartButtonState() {
  const host = players[myUid()];
  if (!host || !host.isHost) {
    startGameBtn.style.display = "none";
    return;
  }

  const allReady = Object.values(players)
    .filter(p => !p.isHost)
    .every(p => p.ready);

  startGameBtn.style.display = allReady ? "block" : "none";
}
