// =====================================================
// roomUI.js — server.js players-only 구조 호환
// =====================================================

const roomContainer = document.getElementById("roomContainer");
const roomPlayerList = document.getElementById("roomPlayerList");
const startBtn = document.getElementById("startBtn");
const readyBtn = document.getElementById("readyBtn");
const roomTitle = document.getElementById("roomTitle");

// 하드 전역
let currentPlayers = {};
let isHost = false;

// =====================================================
// 플레이어 목록 렌더링
// =====================================================
function renderRoomPlayers(players) {
  roomPlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.className = "roomPlayerBox";

    const status = p.isOnline ? "온라인" : "오프라인";

    div.innerHTML = `
      <b>${p.nickname}</b>
      <span>(${status})</span>
      ${p.isHost ? " 👑" : ""}
      <div>${p.ready ? "READY" : ""}</div>
    `;

    roomPlayerList.appendChild(div);
  });
}

// =====================================================
// 플레이어 목록 갱신
// =====================================================
socket.on("playerListUpdate", (data) => {
  // 안정화: server가 players만 보내도 OK
  // players만 담겨있는 객체로 강제 변환
  currentPlayers = data;
  renderRoomPlayers(currentPlayers);

  const me = currentPlayers[window.permUid];
  isHost = me?.isHost;

  if (isHost) {
    startBtn.style.display = "inline-block";
    readyBtn.style.display = "none";
  } else {
    startBtn.style.display = "none";
    readyBtn.style.display = "inline-block";
  }
});

// READY
readyBtn.onclick = () => {
  socket.emit("playerReady", {
    roomId,
    permUid: window.permUid,
  });
};

// HOST → START
startBtn.onclick = () => {
  socket.emit("startGame", {
    roomId,
    permUid: window.permUid,
  });
};

// 방 입장 시 제목 변경
function enterRoom(roomIdValue) {
  roomId = roomIdValue;
  roomTitle.innerText = `방번호: ${roomId}`;
}
