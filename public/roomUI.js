// ================================
// ROOM PAGE LOGIC (대기실)
// ================================

// 전역 socket 사용
const socket = window.socket;

// DOM
const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

let players = {};

// ================================
// 플레이어 목록 업데이트
// ================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
  updateStartButtonState();
});

// ================================
// READY 버튼
// ================================
readyBtn.onclick = () => {
  socket.emit("playerReady", { roomId: window.roomId });
};

// ================================
// 게임 시작 (방장만 가능)
// ================================
startGameBtn.onclick = () => {
  socket.emit("forceStartGame", { roomId: window.roomId });

  // 게임 페이지 전환
  window.showPage("gamePage");
};

// ================================
// 초대 링크 복사
// ================================
copyInviteBtn.onclick = () => {
  const link = `${location.origin}/index.html?room=${window.roomId}`;
  navigator.clipboard.writeText(link);
  alert("초대 링크가 복사되었습니다!\n" + link);
};

// ================================
// UI 렌더링
// ================================
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

    playerListDiv.append(div);
  });
}

// ================================
// 스타트 버튼 활성화
// ================================
function updateStartButtonState() {
  const my = players[window.myUid];
  if (!my || !my.isHost) {
    startGameBtn.style.display = "none";
    return;
  }

  const allReady = Object.values(players)
    .filter(p => !p.isHost)
    .every(p => p.ready);

  startGameBtn.style.display = allReady ? "block" : "none";
}
