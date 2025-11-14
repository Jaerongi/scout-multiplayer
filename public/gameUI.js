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


// ==========================================
// PLAYER LIST
// ==========================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
});


// ==========================================
// ROUND START
// ==========================================
socket.on("roundStart", ({ round, players: p, startingPlayer }) => {
  players = p;
  tableCards = [];

  roundInfo.innerText = `라운드 ${round}`;
  renderPlayerList();
  renderTable();

  myTurn = (startingPlayer === window.myUid);
  highlightTurn(startingPlayer);
});


// ==========================================
// 내 패 받음
// ==========================================
socket.on("yourHand", (handData) => {
  myHand = handData;
  selected.clear();
  flipState = {};

  renderHand();
});


// ==========================================
// 손패 갱신
// ==========================================
socket.on("handCountUpdate", (counts) => {
  for (const uid in players) {
    players[uid].handCount = counts[uid];
  }
  renderPlayerList();
});


// ==========================================
// 테이블 업데이트
// ==========================================
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});


// ==========================================
// 턴 변경
// ==========================================
socket.on("turnChange", (uid) => {
  myTurn = (uid === window.myUid);
  highlightTurn(uid);
});
