// =====================================================
// ROOM UI 최종본
// =====================================================

function updateRoomPlayers(players) {
  const list = document.getElementById("playerList");
  if (!list) return;

  list.innerHTML = "";

  Object.values(players).forEach(p => {
    const div = document.createElement("div");
    div.className = "player-row";

    div.innerHTML = `
      <span>${p.nickname}</span>
      <span>${p.ready ? "✔ 준비됨" : ""}</span>
      <span>${p.isHost ? "(방장)" : ""}</span>
    `;

    list.appendChild(div);
  });
}

// socket.js에서 접근 가능하도록 전역 등록
window.updateRoomPlayers = updateRoomPlayers;
