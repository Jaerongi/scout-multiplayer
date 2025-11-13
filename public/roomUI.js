// =========================================
// SCOUT – ROOM PAGE LOGIC (대기실 UI)
// =========================================


// DOM
const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

// 현재 방 정보
let players = {};

// =========================================
// 플레이어 리스트 업데이트
// =========================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
  updateStartButtonState();
});

// =========================================
// 플레이어 리스트 렌더링
// =========================================
function renderPlayerList() {
  playerListDiv.innerHTML = "";

  Object.values(players).forEach((p) => {
    const box = document.createElement("div");
    box.className = "playerBox";

    if (p.uid === myUid) box.style.background = "#555";

    box.innerHTML = `
      <b>${p.nickname}</b><br>
      상태: ${p.ready ? "✔ READY" : "대기중"}<br>
      ${p.isHost ? "방장" : ""}
    `;

    playerListDiv.append(box);
  });
}

// =========================================
// READY 버튼 토글
// =========================================
readyBtn.onclick = () => {
  socket.emit("playerReady", { roomId });
};

// =========================================
// 게임 시작 버튼 활성화 상태 체크
// =========================================
function updateStartButtonState() {
  const me = players[myUid];
  if (!me) return;

  if (!me.isHost) {
    startGameBtn.style.display = "none";
    return;
  }

  const others = Object.values(players).filter(p => !p.isHost);

  const allReady = others.length > 0 && others.every(p => p.ready);

  startGameBtn.style.display = allReady ? "inline-block" : "none";
}

// =========================================
// 초대 링크 복사
// =========================================
copyInviteBtn.onclick = () => {
  const link = `${location.origin}/?room=${roomId}`;
  navigator.clipboard.writeText(link);
  alert("초대 링크 복사됨:\n" + link);
};

// =========================================
// 게임 시작
// =========================================
startGameBtn.onclick = () => {
  socket.emit("forceStartGame", { roomId });
};

// =========================================
// 게임 페이지로 전환
// =========================================
socket.on("goGame", () => {
  showPage("gamePage");
});

