// ===============================
// ROOM UI FINAL v4
// ===============================

// DOM
const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

// 현재 플레이어 상태 저장
window.currentPlayers = {};


// ===================================
// 플레이어 리스트 렌더링
// ===================================
function renderRoomPlayers(players) {
  playerListDiv.innerHTML = "";
  const arr = Object.values(players);

  arr.forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox waiting";

    // 방장 디자인
    let crown = p.isHost ? "👑 " : "";

    // 준비 LED
    let led =
      !p.isHost
        ? `<span class="ready-led ${p.ready ? "on" : "off"}"></span>`
        : "";

    div.innerHTML = `
      <div class="nick">${crown}${p.nickname}</div>
      <div class="status">
        ${p.isHost ? "(방장)" : p.ready ? "준비 완료" : "대기중"}
        ${led}
      </div>
    `;

    playerListDiv.appendChild(div);
  });
}


// ===================================
// 게임 시작 버튼 활성/비활성
// ===================================
function updateStartButtonState(players) {
  const me = players[myUid];
  if (!me) return;

  if (!me.isHost) {
    startGameBtn.style.display = "none";
    return;
  }

  // 방장일 때만 start 버튼 표시
  startGameBtn.style.display = "inline-block";

  const everyoneReady = Object.values(players)
    .filter((p) => !p.isHost)
    .every((p) => p.ready);

  startGameBtn.disabled = !everyoneReady;
}


// ===================================
// 소켓: 플레이어 목록 갱신
// ===================================
window.socket.on("playerListUpdate", (players) => {
  window.currentPlayers = players;
  renderRoomPlayers(players);
  updateStartButtonState(players);
});


// ===================================
// READY 버튼
// ===================================
readyBtn.onclick = () => {
  if (!roomId || !myUid) return;

  const me = currentPlayers[myUid];
  if (!me) return;

  if (me.isHost) {
    alert("방장은 준비할 필요가 없습니다.");
    return;
  }

  socket.emit("playerReady", { roomId });
};


// ===================================
// 게임 시작
// ===================================
startGameBtn.onclick = () => {
  if (!roomId) return;

  socket.emit("startGame", { roomId });
};


// ===================================
// 초대 링크 복사
// ===================================
copyInviteBtn.onclick = () => {
  const url = `${location.origin}/index.html?room=${roomId}`;
  navigator.clipboard.writeText(url);
  alert("초대 링크가 복사되었습니다!");
};


// ===================================
// 외부로 제공
// ===================================
window.renderRoomPlayers = renderRoomPlayers;
window.updateStartButtonState = updateStartButtonState;
