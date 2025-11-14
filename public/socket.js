// ================================
// GLOBAL SOCKET
// ================================
window.socket = io({
  autoConnect: true,
  transports: ["websocket"]
});

window.myUid = null;
window.myName = null;
window.roomId = null;

socket.on("connect", () => {
  window.myUid = socket.id;
  console.log("SOCKET CONNECTED:", window.myUid);
});

// ================================
// URL PARAM 자동 인식 (🔴 핵심 수정)
// ================================
const urlParams = new URLSearchParams(location.search);
const invitedRoom = urlParams.get("room");
if (invitedRoom) {
  window.roomId = invitedRoom;
  console.log("초대 링크 감지됨 → room:", invitedRoom);
}

// ================================
// PAGE SWITCH
// ================================
window.showPage = function(page) {
  document.getElementById("startPage").style.display = "none";
  document.getElementById("roomPage").style.display = "none";
  document.getElementById("gamePage").style.display = "none";

  document.getElementById(page).style.display = "block";
};

// ================================
// 방 만들기
// ================================
document.getElementById("makeRoomBtn").onclick = () => {
  const name = nicknameInput.value.trim();
  if (!name) return alert("닉네임을 입력하세요.");

  window.myName = name;

  // 초대 링크가 있었다면 덮어쓰지 않음
  if (!window.roomId) {
    window.roomId = generateRoomId();
  }

  console.log("방 생성:", window.roomId);

  socket.emit("joinRoom", { roomId, nickname: myName });

  roomTitle.innerText = `방번호: ${roomId}`;
  showPage("roomPage");
};

// ================================
// 초대 링크 입장
// ================================
document.getElementById("enterRoomBtn").onclick = () => {
  const nickname = prompt("닉네임을 입력하세요:");
  if (!nickname) return;

  window.myName = nickname;

  let room = invitedRoom; // 자동 감지된 방번호

  if (!room) {
    const link = prompt("초대 링크를 붙여넣으세요:");
    if (!link) return;
    const url = new URL(link);
    room = url.searchParams.get("room");
  }

  if (!room) return alert("방 ID를 찾을 수 없습니다.");

  window.roomId = room;

  socket.emit("joinRoom", { roomId, nickname: myName });

  roomTitle.innerText = `방번호: ${room}`;
  showPage("roomPage");
};

// ================================
// 랜덤 방 ID 생성
// ================================
function generateRoomId() {
  const s = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: 6 }, () => s[Math.floor(Math.random() * s.length)]).join('');
}
