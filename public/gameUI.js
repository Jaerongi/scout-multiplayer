// ======================================================
// GAME UI — SCOUT B-STYLE INSERT MENU + TURN FIX + NO MODALS
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

// Flip direction UI
const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

// Insert UI (B 방식)
const insertOverlay = document.getElementById("insertOverlay");
const insertSlots = document.getElementById("insertSlots");

// ======================================================
// STATE
// ======================================================
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let myTurn = false;

// Flip system
let flipSelect = true;
let flipReversed = false;

// SCOUT
let scoutTargetSide = null;
let scoutFlip = false;

// ======================================================
// PLAYER RENDER
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
// HAND (flip 적용)
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
    wrap.className = "tableCardWrap";

    wrap.appendChild(drawScoutCard(c.top, c.bottom));

    // SCOUT 가능 카드 하이라이트 (좌/우만)
    if (idx === 0 || idx === tableCards.length - 1) {
      wrap.classList.add("highlightScout");

      // 버튼 추가
      const btnZone = document.createElement("div");
      btnZone.className = "scoutBtnZone";

      const btnKeep = document.createElement("button");
      btnKeep.innerText = "그대로 가져오기";
      btnKeep.className = "btn-main small";
      btnKeep.onclick = () => beginScout(idx === 0 ? "left" : "right", false);

      const btnFlip = document.createElement("button");
      btnFlip.innerText = "뒤집어서 가져오기";
      btnFlip.className = "btn-orange small";
      btnFlip.onclick = () => beginScout(idx === 0 ? "left" : "right", true);

      btnZone.appendChild(btnKeep);
      btnZone.appendChild(btnFlip);
      wrap.appendChild(btnZone);
    }

    tableArea.appendChild(wrap);
  });
}

// ======================================================
// BEGIN SCOUT → insert overlay 띄우기
// ======================================================
function beginScout(side, flip) {
  if (!myTurn || flipSelect) return;

  scoutTargetSide = side;
  scoutFlip = flip;

  renderInsertOverlay();
}

// ======================================================
// INSERT OVERLAY (B 방식)
// ======================================================
function renderInsertOverlay() {
  insertSlots.innerHTML = "";

  // + 버튼이 맨 앞에도 필요 → 0~length 위치
  const disp = getDisplayedHand();

  for (let i = 0; i <= disp.length; i++) {
    const slot = document.createElement("div");
    slot.className = "insertSlot";
    slot.innerText = "+";
    slot.onclick = () => finishScoutInsert(i);
    insertSlots.appendChild(slot);

    // 카드도 같이 보여줌 (삽입 UI 참고용)
    if (i < disp.length) {
      const preview = document.createElement("div");
      preview.className = "insertPreviewCard";
      preview.appendChild(drawScoutCard(disp[i].top, disp[i].bottom));
      insertSlots.appendChild(preview);
    }
  }

  insertOverlay.classList.remove("hidden");
}

function finishScoutInsert(pos) {
  insertOverlay.classList.add("hidden");

  socket.emit("scout", {
    roomId,
    permUid: window.permUid,
    side: scoutTargetSide,
    flip: scoutFlip,
    pos
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
// BUTTON ENABLE OVER TIME
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
// FLIP SELECTION (정식 스카우트 룰)
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

// 🔥 TURN FIX — permUid로 처리해야 정상 작동
socket.on("turnChange", (uid) => {
  myTurn = (uid === window.permUid);
  highlightTurn(uid);
  updateActionButtons();
});
