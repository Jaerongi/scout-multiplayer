// =======================================================
// ROOM UI — FINAL VERSION (강퇴 기능 포함)
// =======================================================

const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

window.currentPlayers = {};

// ===============================
// 플레이어 리스트 렌더링
// ===============================
function renderRoomPlayers(players) {
  playerListDiv.innerHTML = "";
  const arr = Object.values(players);

  const isMeHost = players[window.permUid]?.isHost;

  arr.forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox waiting";

    if (!p.isOnline) div.classList.add("offlinePlayer");

    const crown = p.isHost ? "👑 " : "";

    const led = !p.isHost
      ? `<span class="ready-led ${p.ready ? "on" : "off"}"></span>`
      : "";

    let kickBtn = "";
    if (isMeHost && !p.isHost) {
      kickBtn = `<button class="kick-btn" data-uid="${p.uid}">강퇴</button>`;
    }

    div.innerHTML = `
      <div class="nick">${crown}${p.nickname}</div>
      <div class="status">
        ${p.isOnline ? (p.isHost ? "(방장)" : p.ready ? "준비완료" : "대기중") : "(오프라인)"}
        ${led}
        ${kickBtn}
      </div>
    `;

    playerListDiv.appendChild(div);
  });
}

// ===============================
// START 버튼 활성화
// ===============================
function updateStartButtonState(players) {
  const me = players[window.permUid];

  if (!me || !me.isHost) {
    startGameBtn.style.display = "none";
    return;
  }

  startGameBtn.style.display = "inline-block";

  const everyoneReady = Object.values(players)
    .filter((p) => !p.isHost)
    .every((p) => p.ready);

  startGameBtn.disabled = !everyoneReady;
}

// ===============================
// 클릭 이벤트 - 강퇴
// ===============================
playerListDiv.onclick = (e) => {
  if (e.target.classList.contains("kick-btn")) {
    const targetUid = e.target.getAttribute("data-uid");

    if (confirm("정말 강퇴하시겠습니까?")) {
      socket.emit("kickPlayer", {
        roomId,
        targetUid,
        permUid: window.permUid,
      });
    }
  }
};

// ===============================
// 서버 → 플레이어 목록 업데이트
// ===============================
socket.on("playerListUpdate", (players) => {
  window.currentPlayers = players;

  renderRoomPlayers(players);
  updateStartButtonState(players);
});

// ===============================
// READY 버튼
// ===============================
readyBtn.onclick = () => {
  socket.emit("playerReady", {
    roomId,
    permUid: window.permUid,
  });
};

// ===============================
// START GAME 버튼
// ===============================
startGameBtn.onclick = () => {
  socket.emit("startGame", {
    roomId,
    permUid: window.permUid,
  });
};

// ===============================
// 초대 링크 복사
// ===============================
copyInviteBtn.onclick = () => {
  const url = `${location.origin}/index.html?room=${roomId}`;
  navigator.clipboard.writeText(url);
  alert("초대 링크가 복사되었습니다!");
};
