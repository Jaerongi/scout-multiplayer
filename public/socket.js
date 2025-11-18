// =====================================================
// SOCKET.JS — 로그인 기반 / 초대 링크 / 방 만들기 / 재접속 복구 FINAL
// =====================================================

// ------------------------------------------------------
// 로그인 체크
// ------------------------------------------------------
window.userId = localStorage.getItem("scout_userId");

// URL에서 초대장 room 번호 가져오기
const params = new URLSearchParams(location.search);
const inviteRoom = params.get("room");

// 초대 링크로 접근했는데 로그인 상태가 아니면 → login.html 로 보내기
if (inviteRoom && !window.userId) {
  localStorage.setItem("inviteRoom", inviteRoom);
  location.href = "/login.html";
}


// ------------------------------------------------------
// 소켓 연결
// ------------------------------------------------------
window.socket = io({
  transports: ["websocket"],
  autoConnect: true
});

window.roomId = null;


// ------------------------------------------------------
// 페이지 전환
// ------------------------------------------------------
window.showPage = function (page) {
  ["startPage", "roomPage", "gamePage"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  document.getElementById(page).style.display = "block";
};


// =====================================================
// 소켓 연결 후 실행되는 영역
// =====================================================
socket.on("connect", () => {

  const params = new URLSearchParams(location.search);
  const rid = params.get("room");

  // 초대 링크 + 로그인 완료 상태
  if (rid && window.userId) {

    // 방 번호 저장
    window.roomId = rid;

    // 방 입장 먼저!
    socket.emit("joinRoom", {
      roomId: rid,
      userId: window.userId
    });

    // UI 업데이트
    const title = document.getElementById("roomTitle");
    if (title) title.innerText = `방번호: ${rid}`;

    // joinRoom이 서버에 반영될 시간을 주고 화면 전환
    setTimeout(() => {
      showPage("roomPage");
    }, 120);

    return;
  }

  // 일반 접속이면 startPage
  showPage("startPage");
});




// =====================================================
// DOM 로드 후 이벤트 연결
// =====================================================
window.addEventListener("load", () => {

  // -----------------------------
  // 방 만들기 버튼
  // -----------------------------
  const makeBtn = document.getElementById("makeRoomBtn");
  if (makeBtn) {
    makeBtn.onclick = () => {
      const id = generateRoomId();
      window.roomId = id;

      socket.emit("joinRoom", {
        roomId: id,
        userId: window.userId
      });

      const title = document.getElementById("roomTitle");
      if (title) title.innerText = `방번호: ${id}`;

      showPage("roomPage");
    };
  }


  // -----------------------------
  // 초대 링크 복사
  // -----------------------------
  const copyBtn = document.getElementById("copyInviteBtn");
  if (copyBtn) {
    copyBtn.onclick = () => {
      const url = `${location.origin}/index.html?room=${window.roomId}`;
      navigator.clipboard.writeText(url);
      alert("초대 링크가 복사되었습니다!");
    };
  }


  // -----------------------------
  // 준비 버튼
  // -----------------------------
  const readyBtn = document.getElementById("readyBtn");
  if (readyBtn) {
    readyBtn.onclick = () => {
      socket.emit("playerReady", {
        roomId: window.roomId,
        userId: window.userId
      });
    };
  }


  // -----------------------------
  // 게임시작 (방장 전용)
  // -----------------------------
  const startGameBtn = document.getElementById("startGameBtn");
  if (startGameBtn) {
    startGameBtn.onclick = () => {
      socket.emit("startGame", {
        roomId: window.roomId,
        userId: window.userId
      });
    };
  }

});




// =====================================================
// 플레이어 목록 업데이트
// =====================================================
socket.on("playerListUpdate", (players) => {
  window.players = players;
  renderPlayers();
});

function renderPlayers() {
  const box = document.getElementById("playerList");
  if (!box || !window.players) return;

  box.innerHTML = "";

  for (const uid in window.players) {
    const p = window.players[uid];

    const isHost = p.isHost ? "👑 " : "";
    const ready = p.ready ? "✔ Ready" : "";

    box.innerHTML += `
      <div style="margin:8px 0;">
        ${isHost}${p.nickname} ${ready}
      </div>
    `;
  }
}




// =====================================================
// 게임 시작 페이지
// =====================================================
socket.on("goGamePage", () => {
  showPage("gamePage");
});






// =====================================================
// 방 폭파 / 강퇴
// =====================================================
socket.on("roomClosed", () => {
  alert("방장이 나가 게임방이 종료되었습니다.");
  showPage("startPage");
});

socket.on("kicked", () => {
  alert("강퇴되었습니다.");
  showPage("startPage");
});





// =====================================================
// 유틸: 방 번호 생성
// =====================================================
function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < 6; i++) {
    r += chars[Math.floor(Math.random() * chars.length)];
  }
  return r;
}
