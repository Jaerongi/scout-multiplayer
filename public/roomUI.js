const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

let players = {};

socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
  updateStartButton();
});

function renderPlayerList() {
  playerListDiv.innerHTML = "";

  Object.values(players).forEach((p) => {
    const box = document.createElement("div");
    box.className = "playerBox";

    if (p.uid === myUid) box.style.background = "#383838";
    if (p.isTurn) box.classList.add("turn-now");

    box.innerHTML = `
      <div><b>${p.nickname}</b></div>
      <div>패: ${p.handCount}장</div>
      <div>점수: ${p.score}</div>
    `;
    playerListDiv.appendChild(box);
  });
}

readyBtn.onclick = () => {
  socket.emit("toggleReady", { roomId });
};

function updateStartButton() {
  const host = Object.values(players).find((p) => p.isHost);
  if (!host) return;

  const allReady = Object.values(players)
    .filter((p) => !p.isHost)
    .every((p) => p.ready);

  if (host.uid === myUid && allReady) {
    startGameBtn.style.display = "inline-block";
  } else {
    startGameBtn.style.display = "none";
  }
}

startGameBtn.onclick = () => {
  socket.emit("startGame", { roomId });
};

copyInviteBtn.onclick = () => {
  const link = `${location.origin}/index.html?room=${roomId}`;
  navigator.clipboard.writeText(link);
  alert("초대 링크가 복사되었습니다!");
};
