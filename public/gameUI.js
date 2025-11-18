// ======================================================
// GAME UI — SCOUT 패 방향 정식 룰 + TURN FIX + Modal 안정판
// ======================================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// DOM Elements
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

// Action buttons
const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// Flip selection UI
const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

// SCOUT modal
const scoutModal = document.getElementById("scoutModal");
const modalKeep = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose = document.getElementById("modalClose");

// Insert modal
const insertModal = document.getElementById("insertModal");
const insertModalContent = document.getElementById("insertModalContent");


// ======================================================
// STATE
// ======================================================

let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();

let myTurn = false;

let flipSelect = true;      // 패 방향 확정 전이면 true
let flipReversed = false;   // false=기본, true=뒤집힘

// Scout state
let scoutTargetSide = null;
let scoutFlip = false;


// ======================================================
// PLAYER LIST
// ======================================================
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


// ======================================================
// HAND (with flip-aware view)
// ======================================================
function getDisplayedHand() {
  if (!flipReversed) return myHand;

  return myHand.map(c => ({ top: c.bottom, bottom: c.top }));
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  const disp = getDisplayedHand();

  disp.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    if (selected.has(i)) wrap.classList.add("selected");

    wrap.onclick = () => {
      if (flipSelect) return alert("패 방향을 먼저 확정하세요!");
      if (selected.has(i)) selected.delete(i);
      else selected.add(i);

      renderHand();
    };

    wrap.appendChild(drawScoutCard(c.top, c.bottom));
    handArea.appendChild(wrap);
  });
}


// ======================================================
// TABLE
// ======================================================
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#555">(비어 있음)</span>`;
    return;
  }

  tableCards.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.appendChild(drawScoutCard(c.top, c.bottom));

    wrap.onclick = () => {
      if (!myTurn || flipSelect) return;
      scoutTargetSide = idx === 0 ? "left" : "right";
      scoutModal.classList.remove("hidden");
    };

    tableArea.appendChild(wrap);
  });
}


// ======================================================
// TURN HIGHLIGHT
// ======================================================
function highlightTurn(uid) {
  const arr = Object.values(players);
  const boxes = gamePlayerList.children;

  arr.forEach((p, i) => {
    if (p.uid === uid) boxes[i].classList.add("turnGlow");
    else boxes[i].classList.remove("turnGlow");
  });
}


// ======================================================
// BUTTON ENABLE CONTROL
// ======================================================
function updateActionButtons() {
  const active = myTurn && !flipSelect;

  [showBtn, scoutBtn, showScoutBtn].forEach(btn => {
    btn.disabled = !active;
    btn.style.opacity = active ? "1" : "0.4";
  });
}


// ======================================================
// SHOW
// ======================================================
showBtn.onclick = () => {
  if (!myTurn || flipSelect) return;

  const disp = getDisplayedHand();
  const chosen = Array.from(selected).map(i => disp[i]);

  if (chosen.length === 0) return alert("카드를 선택하세요.");

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen
  });
};


// ======================================================
// SCOUT
// ======================================================
scoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;
  if (tableCards.length === 0) return;

  scoutModal.classList.remove("hidden");
};

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


// ======================================================
// INSERT POSITION
// ======================================================
function chooseInsertPosition() {
  insertModalContent.innerHTML = `<h3>삽입 위치 선택</h3><br>`;

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
  close.innerText = "닫기";
  close.className = "btn-sub small";
  close.onclick = () => insertModal.classList.add("hidden");

  insertModalContent.appendChild(document.createElement("br"));
  insertModalContent.appendChild(close);

  insertModal.classList.remove("hidden");
}


// ======================================================
// 패 방향 선택 (정식 SCOUT 룰)
// ======================================================
flipToggleBtn.onclick = () => {
  flipReversed = !flipReversed;
  renderHand();
};

flipConfirmBtn.onclick = () => {
  flipSelect = false;
  flipSelectArea.classList.add("hidden");
  updateActionButtons();
};


// ======================================================
// SOCKET EVENTS
// ======================================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

socket.on("roundStart", ({ round, players: p }) => {
  players = p;
  tableCards = [];
  selected.clear();

  flipSelect = true;
  flipReversed = false;

  flipSelectArea.classList.remove("hidden");

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

// 🔥 아주 중요: TURN FIX (socket.id → permUid)
socket.on("turnChange", (uid) => {
  myTurn = (uid === window.permUid);
  highlightTurn(uid);
  updateActionButtons();
});
