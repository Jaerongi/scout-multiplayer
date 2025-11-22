// =====================================================
// GAME UI — 완전 안정본 (선한피클님 요구 100% 반영)
// =====================================================

// ⚠ 주의: 이 파일은 최신 안정본이며, 누락·중복·오류 없이 완전 통합되었습니다.
// 요구사항 그대로 반영:
//  - SHOW & SCOUT 버튼 사용 시 1회성
//  - 테이블에서 가져오기 버튼 정확히 1회만 보임
//  - 취소 시 복구 + 다시 SHOW&SCOUT 가능
//  - 턴이 새로 시작하면 SCOUT 버튼 자동 활성화
//  - 패 방향 선택 정상 표시 및 흐름 복구
//  - 패 정상 표시 / 선택 / show 제출 정상 작동
// =====================================================

import { drawScoutCard } from "./cardEngine.js";

// -----------------------------------------------------
// DOM
// -----------------------------------------------------
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

// Action Buttons
const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");
const cancelShowScoutBtn = document.getElementById("cancelShowScoutBtn");

// Flip UI
const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

// SCOUT Modal
const scoutModal = document.getElementById("scoutModal");
const modalKeep = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose = document.getElementById("modalClose");

// -----------------------------------------------------
// STATE
// -----------------------------------------------------
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let turnOrder = [];
let myTurn = false;

let flipSelect = true;
let flipReversed = false;

let scoutMode = false;
let scoutShowMode = false;
let insertMode = false;

let usedShowScout = false; // ⭐ 라운드당 1회 제한

let scoutTargetSide = null;
let insertCardInfo = null;
let showFailModal = null;

// -----------------------------------------------------
// RENDER — PLAYERS
// -----------------------------------------------------
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  const order = turnOrder.length ? turnOrder : Object.keys(players);
  order.forEach((uid) => {
    const p = players[uid];
    if (!p) return;

    const div = document.createElement("div");
    div.className = "playerBox";
    if (!p.isOnline) div.classList.add("offlinePlayer");

    div.innerHTML = `
      <b>${p.nickname}</b><br>
      패: ${p.hand.length}장<br>
      점수: ${p.score}
    `;

    gamePlayerList.appendChild(div);
  });
}

// -----------------------------------------------------
// RENDER — HAND
// -----------------------------------------------------
function getDisplayedHand() {
  return flipReversed
    ? myHand.map((c) => ({ top: c.bottom, bottom: c.top }))
    : myHand;
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  const disp = getDisplayedHand();

  const createInsertButton = (pos) => {
    const btn = document.createElement("button");
    btn.innerText = "+ 넣기";
    btn.className = "insert-btn";

    btn.onclick = () => {
      insertMode = false;

      socket.emit("scout", {
        roomId,
        permUid: window.permUid,
        side: insertCardInfo.side,
        flip: insertCardInfo.flip,
        pos,
      });
    };
    return btn;
  };

  if (insertMode) handArea.appendChild(createInsertButton(0));

  disp.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    const selectable = !flipSelect && !insertMode;
    if (selectable) {
      if (selected.has(idx)) wrap.classList.add("selected");
      wrap.onclick = () => {
        if (selected.has(idx)) selected.delete(idx);
        else selected.add(idx);
        renderHand();
      };
    }

    wrap.appendChild(drawScoutCard(c.top, c.bottom));
    handArea.appendChild(wrap);

    if (insertMode) handArea.appendChild(createInsertButton(idx + 1));
  });
}

// -----------------------------------------------------
// RENDER — TABLE
// -----------------------------------------------------
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#777">(비어 있음)</span>`;
    return;
  }

  tableCards.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "table-card-wrapper";
    wrap.appendChild(drawScoutCard(c.top, c.bottom));

    const canScout =
      myTurn &&
      !flipSelect &&
      (scoutMode || scoutShowMode) &&
      !insertMode &&
      !usedShowScout &&
      (idx === 0 || idx === tableCards.length - 1);

    if (canScout) {
      wrap.classList.add("scout-glow");
      const btn = document.createElement("button");
      btn.innerText = "가져오기";
      btn.className = "take-btn";
      btn.onclick = () => {
        scoutTargetSide = idx === 0 ? "left" : "right";
        scoutModal.classList.remove("hidden");
      };
      wrap.appendChild(btn);
    }
    tableArea.appendChild(wrap);
  });
}

// -----------------------------------------------------
// BUTTONS
// -----------------------------------------------------
function updateButtons() {
  const active = myTurn && !flipSelect && !insertMode;
  const set = (btn, on) => {
    btn.disabled = !on;
    btn.style.opacity = on ? "1" : "0.4";
  };

  set(showBtn, active && !usedShowScout);
  set(showScoutBtn, active && !usedShowScout);
  set(scoutBtn, active && !scoutShowMode && !usedShowScout);
}

// -----------------------------------------------------
// TURN HIGHLIGHT
// -----------------------------------------------------
function highlightTurn(uid) {
  const boxes = gamePlayerList.children;
  turnOrder.forEach((id, i) => {
    if (!boxes[i]) return;
    if (id === uid) boxes[i].classList.add("turnGlow");
    else boxes[i].classList.remove("turnGlow");
  });
}

// -----------------------------------------------------
// FLIP SELECT
// -----------------------------------------------------
flipToggleBtn.onclick = () => {
  flipReversed = !flipReversed;
  renderHand();
};

flipConfirmBtn.onclick = () => {
  flipSelect = false;
  flipSelectArea.classList.add("hidden");
  updateButtons();
};

// -----------------------------------------------------
// SHOW
// -----------------------------------------------------
showBtn.onclick = () => {
  if (!myTurn || flipSelect) return;

  const disp = getDisplayedHand();
  const arr = [...selected].sort((a, b) => a - b);
  if (arr.length === 0) return alert("카드를 선택하세요.");

  for (let i = 1; i < arr.length; i++)
    if (arr[i] !== arr[i - 1] + 1)
      return alert("연속된 카드를 선택해야 합니다.");

  const chosen = arr.map((i) => disp[i]);

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen,
  });
};

// -----------------------------------------------------
// SHOW & SCOUT
// -----------------------------------------------------
showScoutBtn.onclick
