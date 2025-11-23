// 전역에서 모든 파일이 공통으로 쓰는 socket
window.socket = io();

// 전역 변수
window.roomId = null;
window.myPermUid = null;

// 방 입장 (필요하면 사용할 수 있음)
window.enterRoom = function(roomId, userName, permUid) {
  window.roomId = roomId;

  // ⭐ socket.emit 이 아니라 window.socket.emit 사용해야 함
  window.socket.emit("joinRoom", { roomId, userName, permUid });
};
