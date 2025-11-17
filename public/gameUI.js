// ======================================================
// GAME UI FINAL — 오프라인 표시 + 패 1열 스크롤
// ======================================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// DOM
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let myTurn = false;
let flipConfirmed = false;

// ================================
// 플레이어 리스트 (오프라인 표시 포함)
// ================================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox";
    if (!p.isOnline) div.classList.add("offlinePlayer");

    div.innerHTML = `
      <b>${p.nickname}</b><br>
      패: ${p.hand.length}장<br>
      점수: ${p.score}<br>
      ${p.isOnline ? "" : "<span style='color:#888;'>오프라인</span>"}
    `;
    gamePlayerList.appendChild(div);
  });
}

// ================================
// 내 패 (1열, 가로 스크롤)
// ================================
function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    if (selected.has(i)) wrap.classList.add("selected");

    wrap.onclick = () => {
      if (!flipConfirmed) return alert("패 방향 확정 후 선택하세요!");
      if (selected.has(i)) selected.delete(i);
      else selected.add(i);
      renderHand();
    };

    wrap.appendChild(drawScoutCard(c.top, c.bottom));
    handArea.appendChild(wrap);
  });
}

// ================================
// 테이블
// ================================
function renderTable() {
  tableArea.innerHTML = "";
  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#888;">(비어 있음)</span>`;
    return;
  }

  tableCards.forEach((c) => {
    tableArea.appendChild(drawScoutCard(c.top, c.bottom));
  });
}

// ================================
// TURN HIGHLIGHT
// ================================
function highlightTurn(uid) {
  const boxes = gamePlayerList.children;
  const arr = Object.values(players);

  for (let i = 0; i < arr.length; i++) {
    const box = boxes[i];
    if (arr[i].uid === uid) box.classList.add("turnGlow");
    else box.classList.remove("turnGlow");
  }
}

// ================================
// ACTION BUTTONS
// ================================
function updateActionButtons() {
  const isActive = myTurn;
  [showBtn, scoutBtn, showScoutBtn].forEach(btn => {
    btn.disabled = !isActive;
    btn.style.opacity = isActive ? "1" : "0.4";
  });
}

// 소켓 이벤트
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

socket.on("roundStart", ({ round, players: p }) => {
  players = p;
  tableCards = [];
  selected.clear();
  flipConfirmed = false;

  renderPlayers();
  renderTable();
  renderHand();

  roundInfo.innerText = `라운드 ${round}`;
  updateActionButtons();
});

socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  renderHand();
  updateActionButtons();
});

socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
  updateActionButtons();
});

socket.on("turnChange", (uid) => {
  myTurn = (uid === myUid);
  highlightTurn(uid);
  updateActionButtons();
});

window.renderPlayers = renderPlayers;
window.renderHand = renderHand;
window.renderTable = renderTable;
window.updateActionButtons = updateActionButtons;
window.highlightTurn = highlightTurn;
