// =============================
// ROOM UI
// =============================

const playerList = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

socket.on("playerListUpdate", (players) => {
  window.currentPlayers = players;
  renderRoomPlayers(players);
  updateStartButtonState(players);
});

// -----------------------------------
function renderRoomPlayers(players) {
  playerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerRow";

    const crown = p.isHost ? "👑" : "";
    const led =
      !p.isHost
        ? `<span class="ready-led ${p.ready ? "green" : "red"}"></span>`
        : "";

    div.innerHTML = `
      ${led}
      <span class="playerName">${p.nickname} ${crown}</span>
    `;

    playerList.appendChild(div);
  });

  // host UI rule
  if (players[myUid]?.isHost) {
    readyBtn.style.display = "none";
    startGameBtn.style.display = "inline-block";
  } else {
    readyBtn.style.display = "inline-block";
    startGameBtn.style.display = "none";
  }
}

readyBtn.onclick = () => {
  socket.emit("playerReady", { roomId });
};

startGameBtn.onclick = () => {
  socket.emit("startGame", { roomId });
};

copyInviteBtn.onclick = () => {
  const url = `${location.origin}/?room=${roomId}`;
  navigator.clipboard.writeText(url);
  alert("초대 링크 복사됨:\n" + url);
};

function updateStartButtonState(players) {
  if (!players[myUid]?.isHost) return;

  const allReady = Object.values(players)
    .filter((p) => !p.isHost)
    .every((p) => p.ready);

  startGameBtn.disabled = !allReady;
}
