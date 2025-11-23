let lobbySocket = null;

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("createRoomBtn").onclick = createRoom;
  document.getElementById("joinRoomBtn").onclick = joinRoom;
  document.getElementById("startGameBtn").onclick = () => {
    window.socket.emit("startGame", window.roomId);
  };

  // 서버가 join 성공 시
  window.socket.on("joinedRoom", roomId => {
    window.roomId = roomId;
    enterGamePage();
  });
});

function createRoom() {
  const userName = document.getElementById("userNameInput").value.trim();
  const roomId = document.getElementById("newRoomId").value.trim();

  const permUid = generatePermUid();
  window.myPermUid = permUid;

  window.socket.emit("createRoom", { roomId, userName, permUid });
}

function joinRoom() {
  const userName = document.getElementById("userNameInput").value.trim();
  const roomId = document.getElementById("joinRoomId").value.trim();

  const permUid = generatePermUid();
  window.myPermUid = permUid;

  window.socket.emit("joinRoom", { roomId, userName, permUid });
}

function enterGamePage() {
  document.getElementById("lobbyPage").style.display = "none";
  document.getElementById("gamePage").style.display = "block";
}

function generatePermUid() {
  return "u" + Math.random().toString(36).substr(2, 9);
}
