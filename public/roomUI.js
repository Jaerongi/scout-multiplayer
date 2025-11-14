// ================================
// ROOM PAGE UI LOGIC (대기실)
// ================================

// DOM
const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

// 전역 플레이어 목록 저장
window.currentPlayers = {};


// ================================
// 🔥 [여기] 플레이어 목록 업데이트 리스너
// ================================
socket.on("playerListUpdate", (players) => {
  window.currentPlayers = players;
  renderRoomPlayers(players);
  updateStartButtonState(players);   // 👈 여기서 호출됨
});


// =====================================================
// 📌 2) 항목 — 여기에 붙여넣으면 된다!
// =====================================================
window.updateStartButtonState = function (players) {
  const me = players[window.myUid];
  if (!me) return;

  // 방장만 게임 시작 버튼 활성화
  if (me.isHost) {
    startGameBtn.style.display = "inline-block";
  } else {
    startGameBtn.style.display = "none";
  }
};



// ================================
// 플레이어 리스트 렌더링
// ================================
function renderRoomPlayers(players) {
  /* ... (기존 코드 그대로) ... */
}



// ================================
// READY 버튼
// ================================
readyBtn.onclick = () => {
  socket.emit("playerReady", { roomId });
};


// ================================
// 게임 시작 버튼 (방장만)
// ================================
startGameBtn.onclick = () => {
  /* ... (기존 코드 그대로) ... */
};


// ================================
// 초대 링크 복사
// ================================
copyInviteBtn.onclick = () => {
  /* ... */
};


// ================================
// goGame (게임 화면으로 이동)
// ================================
socket.on("goGame", () => {
  window.showPage("gamePage");
});
