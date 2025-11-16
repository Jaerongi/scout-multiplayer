// ================================
// ROOM PAGE UI LOGIC (대기실)
// ================================

// DOM SELECT
const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

// 전역 플레이어 목록 저장
window.currentPlayers = {};

// ================================
// 플레이어 목록 갱신
// ================================
window.socket.on("playerListUpdate", (players) => {
  window.currentPlayers = players;
  renderRoomPlayers(players);
  updateStartButtonState(players);
});

// ================================
// 플레이어 리스트 렌더링 함수
// ================================
function renderRoomPlayers(players) {
  playerListDiv.innerHTML = "";

  Object.values(players).forEach((p) => {
    const box = document.createElement("div");
    box.className = "roomPlayerBox";

    // 방장 표시
    const crown = p.isHost ? "👑 " : "";

    // 준비 LED
    const led = p.ready
      ? `<span class="led green"></span> 준비완료`
      : `<span class="led gray"></span> 대기중`;

    box.innerHTML = `
      <div class="roomPlayerRow">
        <span class="playerName">${crown}${p.nickname}</span>
        <span class="playerState">${led}</span>
      </div>
    `;

    playerListDiv.appendChild(box);
  });
}

// ================================
// READY 버튼
// ================================
readyBtn.onclick = () => {
  window.socket.emit("playerReady", { roomId: window.roomId });
};

// ================================
// 게임 시작 버튼 (방장만 가능)
// ================================
startGameBtn.onclick = () => {
  const players = window.currentPlayers;

  // 방장 찾기
  const host = Object.values(players).find((p) => p.isHost);

  if (!host || host.uid !== window.myUid) {
    alert("방장만 게임을 시작할 수 있습니다.");
    return;
  }

  // 참가자 준비 확인 (방장 제외)
  const allReady = Object.values(players)
    .filter((p) => !p.isHost)
    .every((p) => p.ready);

  if (!allReady) {
    alert("⚠️ 모든 참가자가 준비완료 상태여야 게임을 시작할 수 있습니다!");
    return;
  }

  // 서버에 게임 시작 요청
  window.socket.emit("forceStartGame", { roomId: window.roomId });
};

// ================================
// 초대 링크 복사
// ================================
copyInviteBtn.onclick = () => {
  const link = `${window.location.origin}/index.html?room=${window.roomId}`;
  navigator.clipboard.writeText(link);
  alert("초대 링크가 복사되었습니다!");
};

// ================================
// 게임 시작 버튼 노출 여부
// ================================
function updateStartButtonState(players) {
  const me = players[window.myUid];
  if (!me) return;

  if (me.isHost) {
    startGameBtn.style.display = "inline-block";
  } else {
    startGameBtn.style.display = "none";
  }
}
