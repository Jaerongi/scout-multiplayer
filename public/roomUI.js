// ==========================================
// SCOUT – ROOM PAGE LOGIC
// ==========================================

// 🔥 socket.js에서 만든 전역 socket을 받음
const socket = window.socket;

let players = {};

const playerListDiv = document.getElementById("playerList");
const readyBtn       = document.getElementById("readyBtn");
const startGameBtn   = document.getElementById("startGameBtn");
const copyInviteBtn  = document.getElementById("copyInviteBtn");


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
  socket.emit("playerReady", { roomId: window.roomId });
};

// ==========================================
// 게임 시작 (방장만)
// ==========================================
startGameBtn.onclick = () => {
  socket.emit("forceStartGame", { roomId: window.roomId });
  window.showPage("gamePage");
};

// ==========================================
// 초대 링크 복사
// ==========================================
copyInviteBtn.onclick = () => {
  const link = `${location.origin}/index.html?room=${window.roomId}`;
  navigator.clipboard.writeText(link);
  alert("초대 링크가 복사되었습니다!\n" + link);
};


// ==========================================
// UI
// ==========================================
function renderPlayerList() {
  playerListDiv.innerHTML = "";

  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox";

    const readyTxt = p.ready ? "🟢 READY" : "⚪ 대기";

    div.innerHTML = `
      <b>${p.nickname}</b>
      <div>${readyTxt}</div>
    `;
    playerListDiv.append(div);
  });
}


function updateStartButtonState() {
  const host = players[window.myUid];
  if (!host || !host.isHost) {
    startGameBtn.style.display = "none";
    return;
  }

  const allReady = Object.values(players)
    .filter(p => !p.isHost)
    .every(p => p.ready);

  startGameBtn.style.display = allReady ? "block" : "none";
}
