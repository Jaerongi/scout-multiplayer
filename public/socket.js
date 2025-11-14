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

socket.on("connect", () => {
  window.myUid = socket.id;
  console.log("SOCKET CONNECTED:", window.myUid);
});

// ================================
// 페이지 전환 함수
// ================================
window.showPage = function(page) {
  document.getElementById("startPage").style.display = "none";
  document.getElementById("roomPage").style.display = "none";
  document.getElementById("gamePage").style.display = "none";

  document.getElementById(page).style.display = "block";
};

// ================================
// START PAGE 이벤트
// ================================
document.getElementById("makeRoomBtn").onclick = () => {
  const name = nicknameInput.value.trim();
  if (!name) return alert("닉네임을 입력하세요.");

  window.myName = name;
  window.roomId = generateRoomId();

  socket.emit("joinRoom", { roomId, nickname: myName });

  document.getElementById("roomTitle").innerText =
    `방번호: ${roomId}`;

  showPage("roomPage");
};

document.getElementById("enterRoomBtn").onclick = () => {
  const link = prompt("초대 링크:");
  if (!link) return;

  const url = new URL(link);
  const id = url.searchParams.get("room");
  const nickname = prompt("닉네임 입력");

  if (!id || !nickname) return alert("잘못된 링크입니다.");

  window.myName = nickname;
  window.roomId = id;

  socket.emit("joinRoom", { roomId, nickname: myName });
  document.getElementById("roomTitle").innerText = `방번호: ${roomId}`;

  showPage("roomPage");
};

// ================================
// 랜덤 방 ID 생성
// ================================
function generateRoomId() {
  const s = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let r = "";
  for (let i = 0; i < 6; i++) r += s[Math.floor(Math.random()*s.length)];
  return r;
}

// ================================
// ROOM + GAME UI 파일 로드 (중요!!)
// ================================
