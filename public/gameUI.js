// ======================================================
// GAME UI — FINAL PERFECT VERSION
// (스카우트 버튼 누를 때만 가져오기 버튼 등장 + 깜박이 테두리)
// ======================================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// DOM Elements
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// Flip UI
const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

// SCOUT 모달
const scoutModal = document.getElementById("scoutModal");
const modalKeep = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose = document.getElementById("modalClose");

// ======================================================
// STATE
// ======================================================
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();

let myTurn = false;
let flipSelect = true;
let flipReversed = false;

// NEW — 스카우트 모드 활성화 여부
let scoutMode = false;

// NEW — 스카우트 방향 관련
let scoutTargetSide = null;
let scoutFlip = false;

// ======================================================
// RENDER — 플레이어
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
      점수: ${p.score}
    `;
    gamePlayerList.appendChild(div);
  });
}

// ======================================================
// RENDER — HAND
// ======================================================
function getDisplayedHand() {
  if (!flipReversed) return myHand;
  return myHand.map((c) => ({ top: c.bottom, bottom: c.top }));
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
// RENDER — TABLE (가져오기 버튼 + 깜빡이는 테두리)
// ======================================================
function renderTable() {
  tableArea.innerHTML = "";
  const count = tableCards.length;

  if (count === 0) {
    tableArea.innerHTML = `<span style='color:#555'>(비어 있음)</span>`;
    return;
  }

  tableCards.forEach((card, idx) => {
    const wrap = document.createElement("div");
    wrap.style.textAlign = "center";
    wrap.style.marginBottom = "16px";

    // 카드 보여주기
    wrap.appendChild(drawScoutCard(card.top, card.bottom));

    const isLeft = idx === 0;
    const isRight = idx === count - 1;

    // 기본: 흐리지 않음
    wrap.style.filter = "brightness(1)";

    // 스카우트 모드가 아닐 때는 버튼/하이라이트 제거
    if (!myTurn || flipSelect || !scoutMode) {
      wrap.style.filter = "brightness(1)";
      tableArea.appendChild(wrap);
      return;
    }

    // -----------------------------------------------------
    // 가져올 수 있는 패 판정
    // -----------------------------------------------------
    let canTake = false;
    let side = null;

    if (count === 1) {
      canTake = true;
      side = "left";
    } else if (count === 2) {
      canTake = true;
      side = idx === 0 ? "left" : "right";
    } else if (count >= 3) {
      if (isLeft) { canTake = true; side = "left"; }
      else if (isRight) { canTake = true; side = "right"; }
    }

    // -----------------------------------------------------
    // 깜빡이는 테두리
    // -----------------------------------------------------
    if (canTake) {
      wrap.classList.add("glow-blink");
    } else {
      wrap.style.filter = "brightness(0.35)";
    }

    // -----------------------------------------------------
    // “가져오기” 버튼 (카드 아래)
    // -----------------------------------------------------
    if (canTake) {
      const btn = document.createElement("button");
      btn.innerText = "가져오기";
      btn.className = "btn-orange small";
      btn.style.marginTop = "10px";
      btn.style.display = "block";
      btn.style.marginLeft = "auto";
      btn.style.marginRight = "auto";

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
// INSERT BUTTONS (+ 버튼)
// ======================================================
function renderInsertButtons() {
  document.querySelectorAll(".insert-btn").forEach((el) => el.remove());

  const cards = handArea.children;
  for (let i = 0; i <= cards.length; i++) {
    const btn = document.createElement("button");
    btn.innerText = "+";
    btn.className = "insert-btn";
    btn.style.margin = "6px";
    btn.style.padding = "5px 8px";
    btn.style.background = "#333";
    btn.style.border = "1px solid #ffd76e";
    btn.style.color = "#ffd76e";
    btn.style.borderRadius = "6px";

    btn.onclick = () => {
      socket.emit("scout", {
        roomId,
        permUid: window.permUid,
        side: scoutTargetSide,
        flip: scoutFlip,
        pos: i,
      });

      document.querySelectorAll(".insert-btn").forEach((el) => el.remove());
    };

    if (i < cards.length) handArea.insertBefore(btn, cards[i]);
    else handArea.appendChild(btn);
  }
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
    cards: chosen,
  });

  scoutMode = false;
};

// ======================================================
// SCOUT 버튼 → 스카우트 모드 켜기
// ======================================================
scoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;
  if (tableCards.length === 0) return;

  // 스카우트 모드 켜기
  scoutMode = true;
  renderTable();
};

// ======================================================
// SCOUT 모달
// ======================================================
modalClose.onclick = () => {
  scoutMode = false;
  scoutModal.classList.add("hidden");
  renderTable();
};

modalKeep.onclick = () => {
  scoutFlip = false;
  scoutMode = false;
  scoutModal.classList.add("hidden");
  renderInsertButtons();
};

modalReverse.onclick = () => {
  scoutFlip = true;
  scoutMode = false;
  scoutModal.classList.add("hidden");
  renderInsertButtons();
};

// ======================================================
// FLIP (방향 선택)
// ======================================================
flipToggleBtn.onclick = () => {
  flipReversed = !flipReversed;
  renderHand();
};

flipConfirmBtn.onclick = () => {
  flipSelect = false;
  flipSelectArea.classList.add("hidden");

  selected.clear();
  renderHand();
  updateActionButtons();
  renderTable();
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
  scoutMode = false;

  flipSelectArea.classList.remove("hidden");

  renderPlayers();
  renderHand();
  renderTable();

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

  scoutMode = false; // 턴 넘어가면 가져오기 버튼/하이라이트 제거
  renderTable();

  updateActionButtons();

  const arr = Object.values(players);
  const boxes = gamePlayerList.children;
  arr.forEach((p, i) => {
    if (p.uid === uid) boxes[i].classList.add("turnGlow");
    else boxes[i].classList.remove("turnGlow");
  });
});
