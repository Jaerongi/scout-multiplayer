// ================================
// ROOM UI LOGIC (최종)
// ================================

// DOM
const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

// 플레이어 목록 업데이트
socket.on("playerListUpdate", (players) => {
  renderRoomPlayers(players);
  updateStartButtonState(players);
  window.currentPlayers = p;
  renderRoomPlayers(p);
  updateStartButtonState(p);
});

// 플레이어 목록 렌더링
function renderRoomPlayers(players) {
  playerListDiv.innerHTML = "";

  Object.values(players).forEach((p) => {
    const box = document.createElement("div");
    box.className = "playerLine";

    // LED 표시
    const ledColor = p.isHost ? "#39FF14" : (p.ready ? "#39FF14" : "#777");
    const led = `<span class="player-led" style="background:${ledColor};"></span>`;

    const crown = p.isHost ? "👑" : "";
    const tagHost = p.isHost ? `<span class="tag-host">방장</span>` : "";
    const stateText = p.isHost ? "준비완료" : (p.ready ? "준비완료" : "대기중");

    box.innerHTML = `
      <div class="player-left">
        ${crown} <b>${p.nickname}</b> ${tagHost}
      </div>

      <div class="player-right">
        ${led}
        <span class="state-text">${stateText}</span>
      </div>
    `;

    playerListDiv.appendChild(box);
  });
}

// READY 버튼
readyBtn.onclick = () => {
  socket.emit("playerReady", { roomId });
};

// 게임 시작 버튼 (방장 전용)
startGameBtn.onclick = () => {
  const players = window.currentPlayers || {};

  // 방장 제외하고 모두 ready인지 확인
  const allReady = Object.values(players)
    .filter(p => !p.isHost)
    .every(p => p.ready);

  if (!allReady) {
    alert("⚠ 아직 준비되지 않은 플레이어가 있습니다.");
    return;
  }

  // 모든 인원이 준비되었을 때만 시작
  socket.emit("forceStartGame", { roomId });
};


// 초대 링크 복사
copyInviteBtn.onclick = () => {
  const link = `${location.origin}/index.html?room=${roomId}`;
  navigator.clipboard.writeText(link);
  alert("초대 링크가 복사되었습니다!\n" + link);
};

// 게임 시작 버튼 활성화 조건
function updateStartButtonState(players) {
  const list = Object.values(players);
  const host = list.find(p => p.isHost);

  // 방장만 버튼 보임
  if (host?.uid !== myUid) {
    startGameBtn.style.display = "none";
    return;
  }

  startGameBtn.style.display = "inline-block";

  // 모든 인원이 READY여야 함 (방장 제외)
  const allReady = list
    .filter(p => !p.isHost)
    .every(p => p.ready);

  startGameBtn.disabled = !allReady;
}


