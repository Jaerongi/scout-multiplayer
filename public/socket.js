// ===============================
// SOCKET.IO UMD 안정 버전
// ===============================

// socket.io UMD는 window.io 로 제공됨
const socket = io({
  transports: ["websocket"]
});

// 전역으로 노출
window.socket = socket;

// 페이지 전환 함수
window.showPage = function (pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("visible"));
  document.getElementById(pageId).classList.add("visible");
};

// 접속 확인 로그
socket.on("connect", () => {
  console.log("SOCKET CONNECTED:", socket.id);
});

// 모듈 내보내기 (gameUI.js, roomUI.js 에서 import 가능)
export { socket };
