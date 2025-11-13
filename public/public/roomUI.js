// =========================================
// SCOUT – ROOM PAGE LOGIC (대기실 UI)
// (싱글 소켓 + SPA 구조)
// =========================================

import { socket, showPage, myUid, myName, roomId } from "./socket.js";

// DOM
const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

// 현재 방 정보 저장
let players = {};

// =========================================
// PLAYERS LIST 업데이트
// =========================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
  updateStartButtonState();
});

// =========================================
// PLAYER LIST 렌더링
// =========================================
function renderPlayerList() {
  playerListDiv.innerHTML = "";

  Object.values(players).forEach((p) => {
    const box = document.createElement("div");
    box.className = "playerBox";

    if (p.uid === myUid) box.style.background = "#555";

    box.innerHTML = `
      <b>${p.nickname}</b><br>
      상태: ${p.ready ? "✔ READY" : "…" }<br>
      방장: ${p.isHost ? "⭐" : ""}
    `;

    playerListDiv.appendChild(box);
  });
}

// =========================================
// READY 버튼
// =========================================
readyBtn.onclick = () => {
  if (!roomId) return;

  socket.emit("playerReady", { roomId });
};

// =========================================
// 게임 시작 버튼 활성화 조건
//   - 방장만 보임
//   - 방장은 READY 필요 없음
//   - 나머지 모든 플레이어가 READY여야 함
// =========================================
function updateStartButtonState() {
  const me = players[myUid];
  if (!me) return;

  if (!me.isHost) {
    startGameBtn.style.display = "none";
    return;
  }

  // 나(방장)를 제외하고 모두 READY인지 체크
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
// 서버가 "goGame" 보내면 → 게임 화면으로 이동
// =========================================
socket.on("goGame", () => {
  showPage("gamePage");
});
