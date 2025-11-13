// socket.js
import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "./shared.js";

// ===============================
// 싱글 소켓
// ===============================
export const socket = io({
  autoConnect: true,
  transports: ["websocket"]   // railway 안정성 ↑
});

let myUid = null;
let myName = null;
let roomId = null;

socket.on("connect", () => {
  myUid = socket.id;
  console.log("SOCKET CONNECTED", myUid);
});

// ===============================
// 화면 전환 함수
// ===============================
export function showPage(page) {
  document.getElementById("startPage").style.display = "none";
  document.getElementById("roomPage").style.display = "none";
  document.getElementById("gamePage").style.display = "none";

  document.getElementById(page).style.display = "block";
}
