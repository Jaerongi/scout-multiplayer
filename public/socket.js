// =====================================================
// SOCKET.JS — 로그인 기반 / 방 만들기 / 초대 링크 / 재접속 복구
// =====================================================

// 로그인 유저 체크
window.userId = localStorage.getItem("scout_userId");
if (!window.userId) location.href = "/login.html";

// 소켓 연결
window.socket = io({
  transports: ["websocket"],
  autoConnect: true
});

window.roomId = null;


// ------------------------------------------------------
// showPage() — 페이지 전환
// ------------------------------------------------------
window.showPage = function(page) {
  ["startPage","roomPage","gamePage"].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  document.getElementById(page).style.display = "block";
};


// ======================================================
// 소켓 연결 후 처리 (초대 링크 로그인 후 자동입장)
// ======================================================
socket.on("connect", ()=>{

  const params = new URLSearchParams(location.search);
  const rid = params.get("room");

  if (rid) {
    window.roomId = rid;

    socket.emit("joinRoom", {
      roomId: rid,
      userId: window.userId
    });

    document.getElementById("roomTitle").innerText = `방번호: ${rid}`;
    showPage("roomPage");
    return;
  }

  showPage("startPage");
});


// ======================================================
// DOM 로드 후 방 만들기 버튼 연결
// ======================================================
window.addEventListener("load", ()=>{

  const btn = document.getElementById("makeRoomBtn");
  if (!btn) return;

  btn.onclick = () => {
    const id = generateRoomId();
    window.roomId = id;

    socket.emit("joinRoom", {
      roomId: id,
      userId: window.userId
    });

    document.getElementById("roomTitle").innerText = `방번호: ${id}`;
    showPage("roomPage");
  };

  // 초대 링크 복사
  const copyBtn = document.getElementById("copyInviteBtn");
  if (copyBtn) {
    copyBtn.onclick = () => {
      const url = `${location.origin}/index.html?room=${window.roomId}`;
      navigator.clipboard.writeText(url);
      alert("초대 링크 복사 완료!");
    };
  }

  // 준비 버튼
  const readyBtn = document.getElementById("readyBtn");
  if (readyBtn) {
    readyBtn.onclick = () => {
      socket.emit("playerReady", {
        roomId: window.roomId,
        userId: window.userId
      });
    };
  }

  // 방장 전용 게임 시작
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


// ======================================================
// 플레이어 리스트 업데이트
// ======================================================
socket.on("playerListUpdate", (players) => {
  window.players = players;
  renderPlayers();
});

function renderPlayers() {
  const box = document.getElementById("playerList");
  if (!box) return;

  let html = "";
  for (const uid in players) {
    const p = players[uid];
    html += `<div>${p.nickname} ${p.ready ? "✔" : ""} ${p.isHost ? "(방장)" : ""}</div>`;
  }
  box.innerHTML = html;
}


// ======================================================
// 게임 UI 이벤트
// ======================================================
socket.on("goGamePage", () => showPage("gamePage"));

socket.on("roundStart", data => {
  showPage("gamePage");
  roundInfo.innerText = `라운드 ${data.round}`;
  renderPlayers();
});

// ======================================================
// 방 폭파 / 강퇴
// ======================================================
socket.on("roomClosed", () => {
  alert("방장이 나가 방이 종료되었습니다.");
  showPage("startPage");
});

socket.on("kicked", () => {
  alert("강퇴되었습니다.");
  showPage("startPage");
});


// ======================================================
// 방번호 생성
// ======================================================
function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i=0; i<6; i++) {
    r += chars[Math.floor(Math.random()*chars.length)];
  }
  return r;
}
