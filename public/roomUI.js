// roomUI.js
const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startBtn = document.getElementById("startGameBtn");
const copyBtn = document.getElementById("copyInviteBtn");

window.socket.on("playerListUpdate", (players) => {
  window.currentPlayers = players;
  renderRoomPlayers(players);
  updateStartButton(players);
});

function renderRoomPlayers(players) {
  playerListDiv.innerHTML = "";

  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.className = "roomPlayer";

    if (p.isHost) div.classList.add("host");

    div.innerHTML = `
      <div class="rname">${p.nickname}${p.isHost ? " 👑" : ""}</div>
      <div class="rready">${p.ready ? "● 준비완료" : "○ 대기중"}</div>
    `;

    playerListDiv.appendChild(div);
  });
}

function updateStartButton(players) {
  const me = players[window.myUid];
  if (!me) return;

  startBtn.style.display = me.isHost ? "inline-block" : "none";

  const others = Object.values(players).filter((p) => !p.isHost);

  const allReady = others.length > 0 && others.every((p) => p.ready);
  startBtn.disabled = !allReady;
}

readyBtn.onclick = () => {
  window.socket.emit("playerReady", { roomId: window.roomId });
};

startBtn.onclick = () => {
  const others = Object.values(window.currentPlayers).filter((p) => !p.isHost);
  const allReady = others.length > 0 && others.every((p) => p.ready);

  if (!allReady) return alert("모든 참가자가 준비 완료해야 합니다!");

  window.socket.emit("forceStartGame", { roomId: window.roomId });
};

copyBtn.onclick = () => {
  const link = `${location.origin}/index.html?room=${window.roomId}`;
  navigator.clipboard.writeText(link);
  alert("초대 링크 복사됨:\n" + link);
};
