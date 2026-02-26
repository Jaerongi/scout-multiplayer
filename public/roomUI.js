// ===============================
// ROOM UI FINAL (Offline 표시 + Start 버튼 제어 + Ready 시스템)
// ===============================

const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

window.currentPlayers = {};

// ===============================
// 플레이어 리스트 렌더링
// ===============================
function renderRoomPlayers(players) {
  playerListDiv.innerHTML = "";
  const arr = Object.values(players);

  arr.forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox waiting";

    if (!p.isOnline) div.classList.add("offlinePlayer");

    const crown = p.isHost ? "👑 " : "";

    const led = !p.isHost
      ? `<span class="ready-led ${p.ready ? "on" : "off"}"></span>`
      : "";

    div.innerHTML = `
      <div class="nick">${crown}${p.nickname}</div>
      <div class="status">
        ${p.isOnline ? (p.isHost ? "(방장)" : p.ready ? "준비완료" : "대기중") : "(오프라인)"}
        ${led}
      </div>
    `;

    playerListDiv.appendChild(div);
  });
}

// ===============================
// START 버튼 활성화 조건
// ===============================
function updateStartButtonState(players) {
  const me = players[window.permUid];

  if (!me || !me.isHost) {
    startGameBtn.style.display = "none";
    return;
  }

  startGameBtn.style.display = "inline-block";

  const everyoneReady = Object.values(players)
    .filter((p) => !p.isHost)
    .every((p) => p.ready);

  startGameBtn.disabled = !everyoneReady;
}

// ===============================
// 서버에서 플레이어 목록 업데이트
// ===============================
socket.on("playerListUpdate", (players) => {
  window.currentPlayers = players;

  renderRoomPlayers(players);
  updateStartButtonState(players);
});

// ===============================
// READY 버튼
// ===============================
readyBtn.onclick = () => {
  socket.emit("playerReady", {
    roomId,
    permUid: window.permUid,
  });
};

// ===============================
// 게임 시작 버튼 (방장 전용)
// ===============================
startGameBtn.onclick = () => {
  socket.emit("startGame", {
    roomId,
    permUid: window.permUid,
  });
};

// ===============================
// 초대 링크 복사
// ===============================
copyInviteBtn.onclick = () => {
  const url = `${location.origin}/index.html?room=${roomId}`;
  navigator.clipboard.writeText(url);
  alert("초대 링크가 복사되었습니다!");
};
