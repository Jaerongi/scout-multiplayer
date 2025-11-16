// socket.js
window.socket = io({
  autoConnect: true,
  transports: ["websocket"]
});

window.myUid = null;
window.myName = null;
window.roomId = null;

socket.on("connect", () => {
  window.myUid = socket.id;
});

window.showPage = (page) => {
  document.getElementById("startPage").style.display = "none";
  document.getElementById("roomPage").style.display = "none";
  document.getElementById("gamePage").style.display = "none";
  document.getElementById(page).style.display = "block";
};

document.getElementById("makeRoomBtn").onclick = () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) return alert("닉네임을 입력하세요.");

  window.myName = nickname;
  window.roomId = randomRoomId();

  socket.emit("joinRoom", { roomId, nickname });
  document.getElementById("roomTitle").innerText = `방번호: ${roomId}`;
  showPage("roomPage");
};

document.getElementById("enterRoomBtn").onclick = () => {
  const link = prompt("초대 링크를 붙여넣어주세요:");
  if (!link) return;

  const url = new URL(link);
  const room = url.searchParams.get("room");
  const nickname = prompt("닉네임을 입력하세요:");

  if (!room || !nickname) return alert("잘못된 링크입니다.");

  window.myName = nickname;
  window.roomId = room;

  socket.emit("joinRoom", { roomId: room, nickname });
  document.getElementById("roomTitle").innerText = `방번호: ${room}`;
  showPage("roomPage");
};

function randomRoomId() {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}
