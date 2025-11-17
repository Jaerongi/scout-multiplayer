// ======================================================
// GAME UI FINAL — Premium Theme + Modal Fix + 1-line Hand
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

const scoutModal = document.getElementById("scoutModal");
const modalKeep = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose = document.getElementById("modalClose");

const insertModal = document.getElementById("insertModal");
const insertModalContent = document.getElementById("insertModalContent");

// STATE
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let myTurn = false;
let flipConfirmed = true;

let scoutTargetSide = null;
let scoutFlip = false;

// ================================
// PLAYERS LIST
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
      ${p.isOnline ? "" : "<span style='color:#aaa;'>오프라인</span>"}
    `;
    gamePlayerList.appendChild(div);
  });
}

// ================================
// MY HAND — 1 LINE SCROLL
// ================================
function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((c, index) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    if (selected.has(index)) wrap.classList.add("selected");

    wrap.onclick = () => {
      if (selected.has(index)) selected.delete(index);
      else selected.add(index);

      renderHand();
    };

    wrap.appendChild(drawScoutCard(c.top, c.bottom));
    handArea.appendChild(wrap);
  });
}

// ================================
// TABLE
// ================================
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#666;">(비어 있음)</span>`;
    return;
  }

  tableCards.forEach((c, index) => {
    const wrap = document.createElement("div");
    wrap.appendChild(drawScoutCard(c.top, c.bottom));
    wrap.onclick = () => {
      if (!myTurn || tableCards.length === 0) return;

      scoutTargetSide = index === 0 ? "left" : "right";

      scoutModal.classList.remove("hidden");
    };

    tableArea.appendChild(wrap);
  });
}

// ================================
// TURN
// ================================
function highlightTurn(uid) {
  const entries = Object.values(players);
  const boxes = gamePlayerList.children;

  entries.forEach((p, idx) => {
    if (p.uid === uid) boxes[idx].classList.add("turnGlow");
    else boxes[idx].classList.remove("turnGlow");
  });
}

// ================================
// BUTTON ENABLE
// ================================
function updateActionButtons() {
  const active = myTurn;

  [showBtn, scoutBtn, showScoutBtn].forEach(btn => {
    btn.disabled = !active;
    btn.style.opacity = active ? "1" : "0.4";
  });
}

// ================================
// SHOW / SCOUT actions
// ================================
showBtn.onclick = () => {
  if (!myTurn) return;

  const chosen = Array.from(selected).map(i => myHand[i]);
  if (chosen.length === 0) return alert("카드를 선택하세요.");

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen
  });
};

scoutBtn.onclick = () => {
  if (!myTurn) return;
  if (tableCards.length === 0) return;

  scoutModal.classList.remove("hidden");
};

showScoutBtn.onclick = () => {
  if (!myTurn) return;
  alert("아직 구현되지 않은 기능입니다!");
};

// ================================
// SCOUT MODAL
// ================================
modalClose.onclick = () => scoutModal.classList.add("hidden");

modalKeep.onclick = () => {
  scoutFlip = false;
  scoutModal.classList.add("hidden");
  chooseInsertPosition();
};

modalReverse.onclick = () => {
  scoutFlip = true;
  scoutModal.classList.add("hidden");
  chooseInsertPosition();
};

// ================================
// INSERT POSITION MODAL
// ================================
function chooseInsertPosition() {
  insertModalContent.innerHTML = "<h3>삽입 위치 선택</h3><br>";

  for (let i = 0; i <= myHand.length; i++) {
    const btn = document.createElement("button");
    btn.innerText = `${i} 번째`;
    btn.className = "btn-main small";
    btn.style.margin = "4px";

    btn.onclick = () => {
      insertModal.classList.add("hidden");

      socket.emit("scout", {
        roomId,
        permUid: window.permUid,
        side: scoutTargetSide,
        flip: scoutFlip,
        pos: i
      });
    };
    insertModalContent.appendChild(btn);
  }

  const close = document.createElement("button");
  close.className = "btn-sub small";
  close.innerText = "닫기";
  close.onclick = () => insertModal.classList.add("hidden");

  insertModalContent.appendChild(document.createElement("br"));
  insertModalContent.appendChild(close);

  insertModal.classList.remove("hidden");
}

// ================================
// SOCKET EVENTS (restore + updates)
// ================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

socket.on("roundStart", ({ round, players: p }) => {
  players = p;
  tableCards = [];
  selected.clear();

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
  myTurn = (uid === socket.id);
  highlightTurn(uid);
  updateActionButtons();
});

// expose for debugging
window.renderPlayers = renderPlayers;
