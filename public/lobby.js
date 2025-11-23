// ==============================
// SCOUT Lobby Script (최종 안정버전)
// ==============================
//
// 1) socket.js 에서 생성한 window.socket 사용
// 2) 방 생성 / 방 참가
// 3) 서버에서 joinedRoom 이벤트 받으면 게임 화면으로 전환
// ==============================

window.addEventListener("DOMContentLoaded", () => {

  // 버튼 바인딩
  document.getElementById("createRoomBtn").onclick = createRoom;
  document.getElementById("joinRoomBtn").onclick = joinRoom;

  // 서버에서 "방 입장 성공" 신호 수신
  window.socket.on("joinedRoom", roomId => {
    console.log("joinedRoom 이벤트 수신:", roomId);
    window.roomId = roomId;

    // 게임 화면으로 이동
    enterGamePage();
  });
});

// ==============================
// 방 생성
// ==============================
function createRoom() {
  const userName = document.getElementById("userNameInput").value.trim();
  const roomId = document.getElementById("newRoomId").value.trim();

  if (!userName || !roomId) {
    alert("닉네임과 방 ID를 입력하세요.");
    return;
  }

  const permUid = generatePermUid();
  window.myPermUid = permUid;

  console.log("방 생성 요청:", roomId, userName);

  // 서버로 방 생성 요청
  window.socket.emit("createRoom", {
    roomId,
    userName,
    permUid
  });
}

// ==============================
// 방 참가
// ==============================
function joinRoom() {
  const userName = document.getElementById("userNameInput").value.trim();
  const roomId = document.getElementById("joinRoomId").value.trim();

  if (!userName || !roomId) {
    alert("닉네임과 방 ID를 입력하세요.");
    return;
  }

  const permUid = generatePermUid();
  window.myPermUid = permUid;

  console.log("방 참가 요청:", roomId, userName);

  window.socket.emit("joinRoom", {
    roomId,
    userName,
    permUid
  });
}

// ==============================
// 게임 화면 전환
// ==============================
function enterGamePage() {
  console.log("게임 페이지로 이동");

  document.getElementById("lobbyPage").style.display = "none";
  document.getElementById("gamePage").style.display = "block";
}

// ==============================
// 고유 유저ID 생성
// ==============================
function generatePermUid() {
  return "u" + Math.random().toString(36).substring(2, 10);
}
