// ==========================================
// GLOBAL SOCKET + 패 방향 확정 기능 포함
// ==========================================

window.socket = io({
  autoConnect: true,
  transports: ["websocket"]
});

window.myUid = null;
window.myName = null;
window.roomId = null;
window.handConfirmed = false;

// 소켓 연결
socket.on("connect", () => {
  window.myUid = socket.id;
  console.log("SOCKET CONNECTED:", myUid);
});

// ==========================================
// 페이지 전환
// ==========================================
window.showPage = function(page) {
  document.getElementById("startPage").style.display = "none";
  document.getElementById("roomPage").style.display = "none";
  document.getElementById("gamePage").style.display = "none";

  document.getElementById(page).style.display = "block";
};

// ==========================================
// 방 만들기
// ==========================================
document.getElementById("makeRoomBtn").onclick = () => {
  const name = nicknameInput.value.trim();
  if (!name) return alert("닉네임을 입력하세요.");

  window.myName = name;
  window.roomId = generateRoomId();
  window.handConfirmed = false;

  socket.emit("joinRoom", { roomId, nickname: myName });

  roomTitle.innerText = `방번호: ${roomId}`;
  showPage("roomPage");
};

// ==========================================
// 초대 링크 입장
// ==========================================
document.getElementById("enterRoomBtn").onclick = () => {
  const link = prompt("초대 링크:");
  if (!link) return;

  try {
    const url = new URL(link);
    const id = url.searchParams.get("room");
    const nickname = prompt("닉네임 입력");

    if (!id || !nickname) return alert("잘못된 링크입니다.");

    window.myName = nickname;
    window.roomId = id;
    window.handConfirmed = false;

    socket.emit("joinRoom", { roomId, nickname: myName });

    roomTitle.innerText = `방번호: ${roomId}`;
    showPage("roomPage");

  } catch {
    alert("유효하지 않은 링크입니다.");
  }
};

// ==========================================
// 패 방향 확정 emit
// ==========================================
window.confirmHandDirection = function() {
  window.handConfirmed = true;

  socket.emit("handConfirmed", {
    roomId,
    uid: myUid
  });
};

// ==========================================
// 서버가 보내는: 누가 확정했는지
// ==========================================
socket.on("handConfirmUpdate", (playerList) => {
  window.currentPlayers = playerList;

  if (typeof window.renderRoomHandConfirm === "function") {
    window.renderRoomHandConfirm(playerList);
  }
});

// ==========================================
// 서버가 보내는: 모두 확정 완료
// ==========================================
socket.on("allHandsConfirmed", () => {
  console.log("모든 플레이어 패 확정 완료!");

  window.allHandsReady = true;

  if (typeof window.enableActionsAfterHandConfirm === "function") {
    window.enableActionsAfterHandConfirm();
  }
});

// ==========================================
// 방 ID 생성
// ==========================================
function generateRoomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let r = "";
  for (let i = 0; i < 6; i++)
    r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}
