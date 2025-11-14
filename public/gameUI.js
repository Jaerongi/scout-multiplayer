// ==========================================
// GAME PAGE LOGIC
// ==========================================

const socket = window.socket;

const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let flipState = {};
let myTurn = false;

// PLAYER LIST
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
});

// ROUND START
socket.on("roundStart", ({ round, players: p, startingPlayer }) => {
  players = p;
  tableCards = [];

  roundInfo.innerText = `라운드 ${round}`;
  renderPlayerList();
  renderTable();

  myTurn = (startingPlayer === window.myUid);
  highlightTurn(startingPlayer);
});

// 내 패 받기
socket.on("yourHand", (handData) => {
  myHand = handData;
  selected.clear();
  flipState = {};
  renderHand();
});

// 손패 갱신
socket.on("handCountUpdate", (counts) => {
  for (const uid in players) {
    players[uid].handCount = counts[uid];
  }
  renderPlayerList();
});

// 테이블
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

// 턴 변경
socket.on("turnChange", (uid) => {
  myTurn = (uid === window.myUid);
  highlightTurn(uid);
});

// ==========================================
// ACTIONS
// ==========================================
showBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (selected.size === 0) return alert("카드를 선택하세요.");

  const selectedCards = [...selected].map(i => {
    const c = myHand[i];
    return flipState[i] === "bottom"
      ? { top: c.bottom, bottom: c.top }
      : c;
  });

  socket.emit("show", { roomId: window.roomId, cards: selectedCards });
  selected.clear();
  flipState = {};
};

scoutBtn.onclick = () => {
  if (!myTurn) return;
  if (tableCards.length !== 1) return alert("스카우트는 1장일 때만 가능");

  const t = tableCards[0];
  const pickBottom = confirm(`bottom(${t.bottom}) 가져갈까요? 취소=top(${t.top})`);
  const chosenValue = pickBottom ? "bottom" : "top";
  socket.emit("scout", { roomId: window.roomId, chosenValue });
};

passBtn.onclick = () => {
  if (!myTurn) return;
  socket.emit("pass", { roomId: window.roomId });
};
