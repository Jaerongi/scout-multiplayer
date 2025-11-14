// ================================
// ROOM UI LOGIC
// ================================

const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

// 플레이어 목록 업데이트
window.socket.on("playerListUpdate", (players) => {
  renderRoomPlayers(players);
  updateStartButtonState(players);
});

function renderRoomPlayers(players) {
  playerListDiv.innerHTML = "";

  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox";

    let crown = p.isHost ? "👑 " : "";
    let readyText = p.isHost ? "(방장)" : (p.ready ? "✔ READY" : "대기중…");

    div.innerHTML = `
      <b>${crown}${p.nickname}</b>
      <div style="font-size:14px; margin-top:5px;">${readyText}</div>
    `;

    playerListDiv.appendChild(div);
  });
}

// READY 버튼
readyBtn.onclick = () => {
  socket.emit("playerReady", { roomId });
};

// 게임 시작 버튼 — 방장 전용
startGameBtn.onclick = () => {
  socket.emit("forceStartGame", { roomId });
};

// 초대 링크 복사
copyInviteBtn.onclick = () => {
  const link = `${location.origin}/index.html?room=${roomId}`;
  navigator.clipboard.writeText(link);
  alert("초대 링크 복사됨:\n" + link);
};

// 게임 시작 버튼 상태
function updateStartButtonState(players) {
  const list = Object.values(players);
  const host = list.find(p => p.isHost);

  if (host?.uid !== window.myUid) {
    startGameBtn.style.display = "none";
    return;
  }

  startGameBtn.style.display = "inline-block";

  const allReady = list
    .filter(p => !p.isHost)
    .every(p => p.ready);

  startGameBtn.disabled = !allReady;
}
