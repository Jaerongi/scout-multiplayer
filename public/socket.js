window.socket = io();

window.roomId = null;
window.myPermUid = null;

// 방 입장
window.enterRoom = function(roomId, userName, permUid) {
  window.roomId = roomId;
  socket.emit("joinRoom", { roomId, userName, permUid });
};

