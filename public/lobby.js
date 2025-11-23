let lobbySocket = null;

window.addEventListener("DOMContentLoaded", () => {
  lobbySocket = io();

  document.getElementById("createRoomBtn").onclick = createRoom;
  document.getElementById("joinRoomBtn").onclick = joinRoom;

  document.getElementById("startGameBtn").onclick = () => {
    lobbySocket.emit("startGame", window.roomId);
  };
});

function createRoom() {
  const userName = document.getElementById("userNameInput").value.trim();
  const roomId = document.getElementById("newRoomId").value.trim();

  if (!userName || !roomId) {
    alert("닉네임과 방 ID를 입력하세요!");
    return;
  }

  const permUid = generatePermUid();
  window.myPermUid = permUid;
  window.roomId = roomId;

  lobbySocket.emit("createRoom", { roomId, userName, permUid });
  enterGamePage();
}

function joinRoom() {
  const userName = document.getElementById("userNameInput").value.trim();
  const roomId = document.getElementById("joinRoomId").value.trim();

  if (!userName || !roomId) {
    alert("닉네임과 방 ID를 입력하세요!");
    return;
  }

  const permUid = generatePermUid();
  window.myPermUid = permUid;
  window.roomId = roomId;

  lobbySocket.emit("joinRoom", { roomId, userName, permUid });
  enterGamePage();
}

function enterGamePage() {
  document.getElementById("lobbyPage").style.display = "none";
  document.getElementById("gamePage").style.display = "block";
}

function generatePermUid() {
  return "u" + Math.random().toString(36).substr(2, 9);
}
