// ======================================================
// GAME UI — FINAL RESTORE (방향 기능 100% 작동)
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

// flip UI
const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

// scout modal
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

let scoutTargetSide = null;
let scoutFlip = false;

// ======================================================
// PLAYER LIST
// ======================================================
function renderPlayers() {
  gamePlayerList.innerHTML = "";
  Object.values(players).forEach(p => {
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
// HAND
// ======================================================
function getDisplayedHand() {
  return flipReversed
    ? myHand.map(c => ({ top: c.bottom, bottom: c.top }))
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
// TABLE (가져오기 버튼 + 하이라이트)
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

    // 카드 표시
    wrap.appendChild(drawScoutCard(card.top, card.bottom));

    // 기본값: 흐리지 않음
    wrap.style.filter = "brightness(1)";

    // 턴이 아니거나 패가 확정되지 않았으면 가져오기 불가
    if (!myTurn || flipSelect) {
      tableArea.appendChild(wrap);
      return;
    }

    // ------------------------------
    // 가져올 수 있는 카드 판정
    // ------------------------------
    let canTake = false;
    let side = null;

    if (count === 1) {
      canTake = true;
      side = "left";
    }

    else if (count === 2) {
      canTake = true;
      side = idx === 0 ? "left" : "right";
    }

    else if (count >= 3) {
      if (idx === 0) {
        canTake = true;
        side = "left";
      } else if (idx === count - 1) {
        canTake = true;
        side = "right";
      } else {
        canTake = false;
      }
    }

    // ------------------------------
    // 하이라이트 처리
    // ------------------------------
    if (canTake) {
      wrap.style.filter = "brightness(1.0)";
      wrap.style.outline = "3px solid #ffd76e";
      wrap.style.outlineOffset = "4px";
    } else {
      wrap.style.filter = "brightness(0.3)";
    }

    // ------------------------------
    // 가져오기 버튼
    // ------------------------------
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
// 삽입 위치 + 버튼 (SCOUT)
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
// TURN 표시
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
// BUTTON 활성화
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
  renderInsertButtons();
};
modalReverse.onclick = () => {
  scoutFlip = true;
  scoutModal.classList.add("hidden");
  renderInsertButtons();
};
// ======================================================
// 패 방향 바꾸기 / 확정 — 완전 수정본
// ======================================================
flipToggleBtn.onclick = () => {
  flipReversed = !flipReversed;
  renderHand();              // ★ 반드시 필요
};

flipConfirmBtn.onclick = () => {
  flipSelect = false;
  flipSelectArea.classList.add("hidden");

  selected.clear();
  renderHand();              // ★ 확정된 방향으로 재그림
  updateActionButtons();
  renderTable();             // ★ 가져오기 버튼 생성 위해 필요
};

// ======================================================
// SOCKET EVENTS
// ======================================================
socket.on("playerListUpdate", p => {
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
  renderHand();
  renderTable();

  roundInfo.innerText = `라운드 ${round}`;
  updateActionButtons();
});

socket.on("yourHand", hand => {
  myHand = hand;
  selected.clear();
  renderHand();
  updateActionButtons();
});

socket.on("tableUpdate", cards => {
  tableCards = cards;
  renderTable();        // ★ 버튼/하이라이트 즉시 업데이트
  updateActionButtons();
});

socket.on("turnChange", uid => {
  myTurn = uid === window.permUid;

  highlightTurn(uid);
  updateActionButtons();
  renderTable();        // ★ 턴 바뀌면 이전 버튼 즉시 제거됨
});

