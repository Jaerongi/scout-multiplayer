// ===============================
// ROOM UI FINAL (Offline + Premium Theme)
// ===============================

const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

window.currentPlayers = {};

function renderRoomPlayers(players) {
  playerListDiv.innerHTML = "";
  const arr = Object.values(players);

  arr.forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox waiting";

    if (!p.isOnline) div.classList.add("offlinePlayer");

    let crown = p.isHost ? "👑 " : "";
    let led = (!p.isHost)
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

function updateStartButtonState(players) {
  const me = players[window.permUid];
  if (!me || !me.isHost) {
    startGameBtn.style.display = "none";
    return;
  }

  startGameBtn.style.display = "inline-block";

  const everyoneReady = Object.values(players)
    .filter(p => !p.isHost)
    .every(p => p.ready);

  startGameBtn.disabled = !everyoneReady;
}

socket.on("playerListUpdate", (players) => {
  window.currentPlayers = players;

  renderRoomPlayers(players);
  updateStartButtonState(players);
});

readyBtn.onclick = () => {
  socket.emit("playerReady", {
    roomId,
    permUid: window.permUid
  });
};

startGameBtn.onclick = () => {
  socket.emit("startGame", {
    roomId,
    permUid: window.permUid
  });
};

copyInviteBtn.onclick = () => {
  const url = `${location.origin}/index.html?room=${roomId}`;
  navigator.clipboard.writeText(url);
  alert("초대 링크가 복사되었습니다!");
};
