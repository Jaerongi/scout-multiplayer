// =====================================================
// roomUI.js — ROOM PAGE UI (2025.11 통합 안정판)
// =====================================================

// DOM elements
const playerListBox = document.getElementById("playerListBox");
const readyBtn = document.getElementById("readyBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const startGameBtn = document.getElementById("startGameBtn");

// =====================================================
// 플레이어 목록 렌더링
// =====================================================
window.renderRoomPlayers = function(players) {
  playerListBox.innerHTML = "";

  const myUid = window.permUid;

  for (const uid in players) {
    const p = players[uid];

    const box = document.createElement("div");
    box.className = "playerBox";
    if (!p.isOnline) box.classList.add("offlinePlayer");

    const youText = (uid === myUid) ? " (나)" : "";
    const hostText = p.isHost ? "⭐" : "";

    box.innerHTML = `
      <div class="playerName">${hostText} ${p.nickname}${youText}</div>
      <div class="playerState">
        ${p.isOnline ? "온라인" : "오프라인"}
        ${p.ready ? "<span class='readyText'> - READY</span>" : ""}
      </div>
    `;

    playerListBox.appendChild(box);
  }

  // 방장만 시작 가능
  const me = players[myUid];
  if (me && me.isHost) {
    startGameBtn.style.display = "inline-block";
  } else {
    startGameBtn.style.display = "none";
  }
};


// =====================================================
// READY 버튼
// =====================================================
readyBtn.onclick = () => {
  if (!window.roomId) return;

  socket.emit("playerReady", {
    roomId: window.roomId,
    permUid: window.permUid
  });
};


// =====================================================
// 초대 링크 복사 버튼
// =====================================================
copyLinkBtn.onclick = () => {
  if (!window.roomId) return;

  const url = `${location.origin}?room=${window.roomId}`;

  navigator.clipboard.writeText(url)
    .then(() => alert("초대 링크가 복사되었습니다!"))
    .catch(() => alert("복사 실패"));
};


// =====================================================
// 게임 시작 버튼 (방장 전용)
// =====================================================
startGameBtn.onclick = () => {
  if (!window.roomId) return;

  socket.emit("startGame", {
    roomId: window.roomId,
    permUid: window.permUid
  });
};


// debug log
console.log("roomUI.js loaded (GLOBAL VERSION)");
