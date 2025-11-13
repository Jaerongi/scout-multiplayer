// ================================
// SCOUT – SINGLE SOCKET ENGINE
// ================================

export let myUid = null;
export let myName = null;
export let roomId = null;

// Socket을 가장 먼저 초기화
export const socket = io({
  autoConnect: true,
  transports: ["websocket"],
});

// 연결되면 uid 저장
socket.on("connect", () => {
  myUid = socket.id;
  console.log("SOCKET CONNECTED:", myUid);
});

// SPA 페이지 전환기
export function showPage(page) {
  document.querySelectorAll(".page").forEach(p => p.style.display = "none");
  document.getElementById(page).style.display = "block";
}

// ============================
// START PAGE 이벤트
// ============================
document.getElementById("makeRoomBtn").onclick = () => {
  const name = document.getElementById("nicknameInput").value.trim();
  if (!name) return alert("닉네임을 입력하세요.");

  myName = name;
  roomId = generateRoomId();

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

function generateRoomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({length: 6}, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

// ============================
// 모든 UI 파일들은 socket 초기화 후 로드
// ============================
import "./roomUI.js";
import "./gameUI.js";
