// ===============================================
// ROOM PAGE UI LOGIC (최종본)
// ===============================================

// window.socket, myUid, myName, roomId 사용
const socket = window.socket;

// DOM 요소
const playerListDiv = document.getElementById("playerList");
const handStatusDiv = document.getElementById("handStatus");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

// 현재 방의 플레이어 목록
let roomPlayers = {};

// 서버로부터 플레이어 목록 업데이트
socket.on("playerListUpdate", (players) => {
  roomPlayers = players;
  renderRoomPlayers(players);
  updateStartButton(players);
});

// 서버가 패 방향 확정 상태를 보내줌
window.renderRoomHandConfirm = function(players) {
  renderRoomPlayers(players);
  updateStartButton(players);
};

// ===============================================
// 플레이어 리스트 렌더링
// ===============================================
function renderRoomPlayers(players) {
  playerListDiv.innerHTML = "";

  Object.values(players).forEach((p) => {
    const row = document.createElement("div");
    row.className = "roomPlayerRow";

    const crown = p.isHost ? "👑 " : "";

    const status =
      p.handConfirmed ? `<span class="readyMark green">●</span>` 
                      : `<span class="readyMark red">●</span>`;

    row.innerHTML = `
      ${crown}${p.nickname}
      <span class="statusText">${status}</span>
    `;

    playerListDiv.appendChild(row);
  });

  // 상태 메시지 업데이트
  const all = Object.values(players);
  const confirmedCount = all.filter(p => p.handConfirmed).length;

  handStatusDiv.innerText =
    (confirmedCount === all.length)
    ? "모든 플레이어가 패 방향 선택 완료!"
    : `패 방향 확정 대기 중 (${confirmedCount}/${all.length})`;
}

// ===============================================
// 패 방향 확정 버튼
// ===============================================
readyBtn.onclick = () => {
  if (window.handConfirmed) {
    alert("이미 확정했습니다!");
    return;
  }
  if (!confirm("패 방향을 확정하시겠습니까? 이후에는 변경할 수 없습니다.")) return;

  window.confirmHandDirection();
};

// ===============================================
// 게임 시작 버튼 활성화 여부
// ===============================================
function updateStartButton(players) {
  const list = Object.values(players);

  const host = list.find(p => p.isHost);
  const me = players[window.myUid];

  if (!host) return;

  // 방장 여부
  if (me && me.isHost) {
    startGameBtn.style.display = "inline-block";

    // 모든 플레이어가 패 확정 완료해야 시작 가능
    const allConfirmed = list.every(p => p.handConfirmed);
    startGameBtn.disabled = !allConfirmed;

  } else {
    startGameBtn.style.display = "none"; // 게스트는 게임 시작 버튼 없음
  }
}

// ===============================================
// 게임 시작
// ===============================================
startGameBtn.onclick = () => {
  const list = Object.values(roomPlayers);
  const allDone = list.every(p => p.handConfirmed);

  if (!allDone) {
    alert("아직 패 방향을 확정하지 않은 플레이어가 있습니다.");
    return;
  }

  socket.emit("forceStartGame", { roomId: window.roomId });
};

// ===============================================
// 초대 링크 복사
// ===============================================
copyInviteBtn.onclick = () => {
  const link = `${location.origin}/index.html?room=${window.roomId}`;
  navigator.clipboard.writeText(link);
  alert("초대 링크가 복사되었습니다!\n" + link);
};
