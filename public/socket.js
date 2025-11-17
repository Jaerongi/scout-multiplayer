// ===============================
// SOCKET MODULE EXPORT VERSION
// ===============================

import { io } from "/socket.io/socket.io.esm.min.js";

// 소켓 생성
export const socket = io({
  transports: ["websocket"],
});

// 전역에서도 접근 가능하도록
window.socket = socket;

// 페이지 전환 함수도 여기서 관리
window.showPage = function (pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("visible"));
  document.getElementById(pageId).classList.add("visible");
};

// 접속 로그
socket.on("connect", () => {
  console.log("SOCKET CONNECTED:", socket.id);
});
