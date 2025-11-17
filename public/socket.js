// ================================
// GLOBAL SOCKET (전역)
// ================================
window.socket = io({
  autoConnect: true,
  transports: ["websocket"]
});

window.myUid = null;
window.myName = null;
window.roomId = null;

// 패 방향 확정 여부
window.handConfirmed = false;

socket.on("connect", () => {
  window.myUid = socket.id;
  console.log("SOCKET CONNECTED:", myUid);
});

// ================================
// PAGE SWITCHER
// ================================
window.showPage = function(page) {
  document.getElementById("startPage").style.display = "none";
  document.getElementById("roomPage").style.display = "none";
  document.getElementById("gamePage").style.display = "none";

  document.getElementById(page).style.display = "block";
};
// 게임 화면 이동
socket.on("goGamePage", () => {
  showPage("gamePage");
});

// ================================
// 방 생성
// ================================
document.getElementById("makeRoomBtn").onclick = () => {
  const name = nicknameInput.value.trim();
  if (!name) return alert("닉네임을 입력하세요.");

  myName = name;
  roomId = generateRoomId();
  window.handConfirmed = false;

  socket.emit("joinRoom", { roomId, nickname: myName });

  roomTitle.innerText = `방번호: ${roomId}`;
  showPage("roomPage");
};

// ================================
// 초대 링크 입장
// ================================
document.getElementById("enterRoomBtn").onclick = () => {
  const link = prompt("초대 링크를 입력하세요:");
  if (!link) return;

  try {
    const url = new URL(link);
    const id = url.searchParams.get("room");
    const nickname = prompt("닉네임 입력");

    if (!id || !nickname) return alert("잘못된 링크입니다.");

    myName = nickname;
    roomId = id;
    window.handConfirmed = false;

    socket.emit("joinRoom", { roomId, nickname: myName });

    roomTitle.innerText = `방번호: ${roomId}`;
    showPage("roomPage");

  } catch {
    alert("유효하지 않은 링크입니다.");
  }
};

// ================================
// handConfirmed 이벤트 (내가 확정했을 때 서버로 전송)
// ================================
window.confirmHandDirection = function() {
  window.handConfirmed = true;

  socket.emit("handConfirmed", {
    roomId,
    uid: myUid
  });
};

// ================================
// 서버가 알려주는: 누가 패 방향 확정했는가?
// ================================
socket.on("handConfirmUpdate", (playerList) => {
  window.currentPlayers = playerList;

  // UI 업데이트 (roomUI.js 내부 함수 호출)
  if (typeof window.renderRoomHandConfirm === "function") {
    window.renderRoomHandConfirm(playerList);
  }
});

// ================================
// 서버가 알려주는: 모든 플레이어가 패 방향 확정 완료
// ================================
socket.on("allHandsConfirmed", () => {
  console.log("모든 플레이어 패 확정 완료!");

  // gameUI.js 에 신호 전달하여 SHOW/SCOUT 활성화
  window.allHandsReady = true;

  if (typeof window.enableActionsAfterHandConfirm === "function") {
    window.enableActionsAfterHandConfirm();
  }
});

// ================================
// 방 ID 생성
// ================================
function generateRoomId() {
  const s = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let r = "";
  for (let i = 0; i < 6; i++) r += s[Math.floor(Math.random() * s.length)];
  return r;
}

