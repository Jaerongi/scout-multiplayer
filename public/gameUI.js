// ======================================================
// GAME UI — SCOUT 정식 룰 패 방향 시스템 + Premium Theme
// ======================================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// DOM
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

// Action buttons
const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// Flip selection UI (정식 스카우트 룰)
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

// 패 방향 시스템
let flipSelect = true;     // 라운드 시작 시 true
let flipReversed = false;  // false = 기본, true = 뒤집힌 상태

// SCOUT modal 상태
let scoutTargetSide = null;
let scoutFlip = false;


// ======================================================
// 플레이어 render
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
      ${p.isOnline ? "" : "<span style='color:#888;'>오프라인</span>"}
    `;
    gamePlayerList.appendChild(div);
  });
}


// ======================================================
// Hand render (패 방향 적용한 버전)
// ======================================================
function getDisplayedHand() {
  if (!flipReversed) return myHand;

  return myHand.map(c => ({
    top: c.bottom,
    bottom: c.top
  }));
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  const disp = getDisplayedHand();

  disp.forEach((c, index) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    if (selected.has(index)) wrap.classList.add("selected");

    wrap.onclick = () => {
      if (flipSelect) return alert("패 방향을 먼저 확정하세요!");
      if (selected.has(index)) selected.delete(index);
      else selected.add(index);
      renderHand();
    };

    wrap.appendChild(drawScoutCard(c.top, c.bottom));
    handArea.appendChild(wrap);
  });
}


// ======================================================
// TABLE render
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
      if (tableCards.length === 0) return;

      scoutTargetSide = idx === 0 ? "left" : "right";
      scoutModal.classList.remove("hidden");
    };

    tableArea.appendChild(wrap);
  });
}


// ======================================================
// Turn highlight
// ======================================================
function highlightTurn(uid) {
  const boxes = gamePlayerList.children;
  const arr = Object.values(players);

  arr.forEach((p, i) => {
    if (p.uid === uid) boxes[i].classList.add("turnGlow");
    else boxes[i].classList.remove("turnGlow");
  });
}


// ======================================================
// BUTTON 활성화
// ======================================================
function updateActionButtons() {
  const enabled = myTurn && !flipSelect;

  [showBtn, scoutBtn, showScoutBtn].forEach(btn => {
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? "1" : "0.4";
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
// Insert position modal
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
// 패 방향 선택 (스카우트 정식 룰)
// ======================================================
flipToggleBtn.onclick = () => {
  flipReversed = !flipReversed;
  renderHand();
};

flipConfirmBtn.onclick = () => {
  if (!flipSelect) return;

  flipSelect = false;
  flipSelectArea.classList.add("hidden");

  updateActionButtons();
  renderHand();
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

socket.on("turnChange", (uid) => {
  myTurn = (uid === socket.id);
  highlightTurn(uid);
  updateActionButtons();
});
