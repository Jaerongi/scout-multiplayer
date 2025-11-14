// ==========================================
// SCOUT – ROOM PAGE LOGIC (대기실 UI)
// window.socket / window.myUid 구조 대응 버전
// ==========================================

// DOM 요소
const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

// 현재 방의 플레이어 목록 (로컬 저장)
let players = {};

// =============================
// 플레이어 목록 업데이트
// =============================
window.socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
  updateStartButtonState();
});

// =============================
// 게임 시작 신호
// =============================
window.socket.on("goGame", () => {
  window.showPage("gamePage");
});

// =============================
// Ready 버튼
// =============================
readyBtn.onclick = () => {
  if (!window.roomId) return;

  window.socket.emit("playerReady", { roomId: window.roomId });
};

// =============================
// 게임 시작 버튼 (방장만 가능)
// =============================
startGameBtn.onclick = () => {
  if (!window.roomId) return;

  window.socket.emit("forceStartGame", { roomId: window.roomId });
};

// =============================
// 초대 링크 복사
// =============================
copyInviteBtn.onclick = () => {
  const link = `${location.origin}/?room=${window.roomId}`;
  navigator.clipboard.writeText(link);
  alert("초대 링크가 복사되었습니다!\n" + link);
};

// =============================
// START 버튼 활성화 여부
// =============================
function updateStartButtonState() {
  const myInfo = players[window.myUid];
  if (!myInfo) return;

  const isHost = myInfo.isHost;

  if (!isHost) {
    startGameBtn.style.display = "none";
    return;
  }

  const allReady = Object.values(players).every(p => p.ready);
  startGameBtn.style.display = allReady ? "inline-block" : "none";
}

// =============================
// 플레이어 리스트 렌더링
// =============================
function renderPlayerList() {
  playerListDiv.innerHTML = "";

  Object.values(players).forEach(p => {
    const div = document.createElement("div");
    div.className = "playerBox";

    if (p.uid === window.myUid)
      div.style.background = "#333";

    div.innerHTML = `
      <b>${p.nickname}</b><br>
      Ready: ${p.ready ? "✔" : "❌"}<br>
      점수: ${p.score}<br>
      패: ${p.handCount}장
    `;

    playerListDiv.appendChild(div);
  });
}
