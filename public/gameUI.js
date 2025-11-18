// ======================================================
// GAME UI — 완전 복원본
// (테이블 가져오기 버튼 + SCOUT 하이라이트 + 패 사이 + 버튼)
// ======================================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// DOM Elements
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

// Buttons
const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// Flip select UI
const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

// SCOUT modal
const scoutModal = document.getElementById("scoutModal");
const modalKeep = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose = document.getElementById("modalClose");

// ================================
// STATE
// ================================
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();

let myTurn = false;

let flipSelect = true;
let flipReversed = false;

// SCOUT temp
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
// HAND RENDER
// ======================================================
function getDisplayedHand() {
  return flipReversed
    ? myHand.map((c) => ({ top: c.bottom, bottom: c.top }))
    : myHand;
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
// TABLE RENDER (가져오기 버튼 + 하이라이트 + 복원 로직 포함)
// ======================================================
function renderTable() {
  tableArea.innerHTML = "";

  const count = tableCards.length;

  if (count === 0) {
    tableArea.innerHTML = `<span style="color:#555">(비어 있음)</span>`;
    return;
  }

  tableCards.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.style.textAlign = "center";

    wrap.appendChild(drawScoutCard(c.top, c.bottom));

    // 턴이 아니면 아무 표시 안함
    if (!myTurn || flipSelect) {
      tableArea.appendChild(wrap);
      return;
    }

    // ================================
    // 가져올 수 있는 위치 판정
    // ================================
    let canTake = false;
    let side = null;

    if (count === 1) {
      canTake = true;
      side = "left";
      wrap.style.filter = "brightness(1)";
    }

    else if (count === 2) {
      canTake = true;
      side = idx === 0 ? "left" : "right";
      wrap.style.filter = "brightness(1)";
    }

    else if (count >= 3) {
      if (idx === 0) {
        canTake = true;
        side = "left";
        wrap.style.filter = "brightness(1)";
      }
      else if (idx === count - 1) {
        canTake = true;
        side = "right";
        wrap.style.filter = "brightness(1)";
      }
      else {
        wrap.style.filter = "brightness(0.4)";
      }
    }

    // ================================
    // 가져오기 버튼 표시
    // ================================
    if (canTake) {
      const btn = document.createElement("button");
      btn.innerText = "가져오기";
      btn.className = "btn-orange small";
      btn.style.marginTop = "6px";

      btn.onclick = () => {
        scoutTargetSide = side;
        scoutModal.classList.remove("hidden");
      };

      wrap.appendChild(btn);
    }

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
// BUTTON CONTROL
// ======================================================
function updateActionButtons() {
  const active = myTurn && !flipSelect;

  [showBtn, scoutBtn, showScoutBtn].forEach((btn) => {
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
  const chosen = Array.from(selected).map((i) => disp[i]);

  if (chosen.length === 0) return alert("카드를 선택하세요.");

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen
  });
};

// ======================================================
// SCOUT 버튼 클릭 → 방향 선택 모달
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
  renderInsertButtons();
};

modalReverse.onclick = () => {
  scoutFlip = true;
  scoutModal.classList.add("hidden");
  renderInsertButtons();
};

// ======================================================
// ★ 패 사이에 + 버튼 생성 (복원한 정확한 동작)
// ======================================================
function renderInsertButtons() {
  document.querySelectorAll(".insert-btn").forEach(el => el.remove());

  const cards = handArea.children;

  for (let i = 0; i <= cards.length; i++) {
    const btn = document.createElement("button");
    btn.innerText = "+";
    btn.className = "insert-btn";
    btn.style.margin = "6px";
    btn.style.padding = "4px 8px";
    btn.style.background = "#333";
    btn.style.border = "1px solid #ffd76e";
    btn.style.color = "#ffd76e";
    btn.style.borderRadius = "6px";
    btn.style.cursor = "pointer";

    btn.onclick = () => {
      socket.emit("scout", {
        roomId,
        permUid: window.permUid,
        side: scoutTargetSide,
        flip: scoutFlip,
        pos: i
      });

      document.querySelectorAll(".insert-btn").forEach(el => el.remove());
    };

    if (i < cards.length) handArea.insertBefore(btn, cards[i]);
    else handArea.appendChild(btn);
  }
}

// ======================================================
// FLIP SELECT
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

socket.on("turnChange", (uid) => {
  myTurn = uid === window.permUid;
  highlightTurn(uid);
  updateActionButtons();
});
