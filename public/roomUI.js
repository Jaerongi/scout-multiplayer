// =============================================
// ROOM UI  (수정본)
// =============================================

// DOM
const playerListDiv = document.getElementById("playerList");
const readyBtn = document.getElementById("readyBtn");
const startGameBtn = document.getElementById("startGameBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");

window.currentPlayers = {};

// 플레이어 리스트 갱신
window.renderRoomPlayers = function (players) {
  playerListDiv.innerHTML = "";
  const myId = window.myUid;

  Object.values(players).forEach((p) => {
    const wrap = document.createElement("div");
    wrap.className = "roomPlayerRow";

    // 닉네임 + 방장아이콘
    let nameHTML = "";
    if (p.isHost) {
      nameHTML = `👑 <b>${p.nickname}</b> <span class="host-tag"> (방장)</span>`;
    } else {
      nameHTML = `<b>${p.nickname}</b>`;
    }

    // LED 표시는 '참가자만'
    let ledHTML = "";
    if (!p.isHost) {
      ledHTML = `<span class="led ${p.ready ? "green" : "gray"}"></span>
                 <span class="readyText">${p.ready ? "준비완료" : "대기중"}</span>`;
    }

    wrap.innerHTML = `
      <div class="playerName">${nameHTML}</div>
      <div class="playerReadyState">${ledHTML}</div>
    `;

    playerListDiv.appendChild(wrap);
  });
};

// READY 버튼 (방장 제외)
readyBtn.onclick = () => {
  socket.emit("playerReady", { roomId: window.roomId });
};

// 게임 시작 버튼
startGameBtn.onclick = () => {
  const players = window.currentPlayers;

  // 참가자만 체크 (방장은 제외)
  const allReady = Object.values(players)
    .filter((p) => !p.isHost)       // 방장 제외
    .every((p) => p.ready === true);

  if (!allReady) {
    alert("⚠️ 모든 참가자가 준비 완료 상태가 아닙니다!");
    return;
  }

  // 정상적으로 시작
  socket.emit("forceStartGame", { roomId: window.roomId });
};

// 초대 링크 복사
copyInviteBtn.onclick = () => {
  const link = `${location.origin}/index.html?room=${window.roomId}`;
  navigator.clipboard.writeText(link);
  alert("초대 링크가 복사되었습니다!\n" + link);
};

// 소켓으로부터 리스트 업데이트 받음
socket.on("playerListUpdate", (p) => {
  window.currentPlayers = p;
  renderRoomPlayers(p);
  updateStartButtonState(p);
});

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

// 게임 시작 신호 → 게임 화면으로 이동
socket.on("goGame", () => {
  window.showPage("gamePage");
});

