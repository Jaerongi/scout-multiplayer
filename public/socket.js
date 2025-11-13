// ================================
// SCOUT – SINGLE SOCKET ENGINE
// SPA (start/room/game) 구조 핵심 파일
// ================================

import "./roomUI.js";
import "./gameUI.js";

export const socket = io({
  autoConnect: true,
  transports: ["websocket"],   // Railway 안정성 증가
});

console.log("SOCKET INIT…");

// ======================================
// GLOBAL STATE
// ======================================
export let myUid = null;
export let myName = null;
export let roomId = null;

socket.on("connect", () => {
  myUid = socket.id;
  console.log("SOCKET CONNECTED:", myUid);
});

// ======================================
// PAGE SWITCHER (SPA 핵심)
// ======================================
export function showPage(page) {
  document.getElementById("startPage").style.display = "none";
  document.getElementById("roomPage").style.display = "none";
  document.getElementById("gamePage").style.display = "none";

  document.getElementById(page).style.display = "block";
}

// ======================================
// START PAGE – 버튼 이벤트
// ======================================
document.getElementById("makeRoomBtn").onclick = () => {
  const name = document.getElementById("nicknameInput").value.trim();
  if (!name) return alert("닉네임을 입력하세요.");

  myName = name;
  roomId = generateRoomId();

  console.log("CREATE ROOM:", roomId);

  socket.emit("joinRoom", { roomId, nickname: myName });

  document.getElementById("roomTitle").innerText = `방번호: ${roomId}`;
  showPage("roomPage");
};

document.getElementById("enterRoomBtn").onclick = () => {
  const link = prompt("초대 링크를 붙여넣어주세요:");
  if (!link) return;

  try {
    const url = new URL(link);
    const id = url.searchParams.get("room");
    const nickname = prompt("닉네임을 입력하세요:");

    if (!id || !nickname) return alert("잘못된 링크입니다.");

    roomId = id;
    myName = nickname;

    socket.emit("joinRoom", { roomId, nickname: myName });

    document.getElementById("roomTitle").innerText = `방번호: ${roomId}`;
    showPage("roomPage");
  } catch (err) {
    alert("유효하지 않은 링크입니다.");
  }
};

// ======================================
// 방 ID 생성 – 랜덤 6글자
// ======================================
function generateRoomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let r = "";
  for (let i = 0; i < 6; i++) {
    r += chars[Math.floor(Math.random() * chars.length)];
  }
  return r;
}
