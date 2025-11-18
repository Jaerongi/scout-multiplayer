// ======================================================
// GAME UI — FINAL STABLE VERSION (READY LED + FLIP FIXED)
// ======================================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// DOM
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

// Buttons
const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");

// Flip UI
const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

// SCOUT modal
const scoutModal = document.getElementById("scoutModal");
const modalKeep = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose = document.getElementById("modalClose");

// ======================================================
// STATE (중요! players → gamePlayers 로 변경)
// ======================================================
let gamePlayers = {};
let tableCards = [];
let myHand = [];
let selected = new Set();

let myTurn = false;
let flipSelect = true;
let flipReversed = false;

let scoutMode = false;
let scoutTargetSide = null;
let scoutFlip = false;

// ======================================================
// PLAYER LIST
// ======================================================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  Object.values(gamePlayers).forEach((p) => {
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
// HAND RENDER (+ INSERT BUTTON)
// ======================================================
function getDisplayedHand() {
  if (!flipReversed) return myHand;
  return myHand.map((c) => ({ top: c.bottom, bottom: c.top }));
}

function createInsertButton(pos) {
  const btn = document.createElement("button");
  btn.className = "insert-btn";
  btn.innerText = "+넣기";

  btn.onclick = () => {
    socket.emit("scout", {
      roomId,
      permUid: window.permUid,
      side: scoutTargetSide,
      flip: scoutFlip,
      pos: pos,
    });

    scoutMode = false;
    renderTable();
    renderHand();
  };

  const wrap = document.createElement("div");
  wrap.className = "insert-wrapper";
  wrap.appendChild(btn);

  return wrap;
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  const disp = getDisplayedHand();

  // ❗ flipSelect=true → insert 버튼 절대 생성하면 안 됨
  const allowInsert = scoutMode && !flipSelect;

  if (allowInsert) {
    handArea.appendChild(createInsertButton(0));
  }

  disp.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    // SHOW 모드일 때만 카드 선택 가능
    if (!scoutMode) {
      if (selected.has(i)) wrap.classList.add("selected");

      wrap.onclick = () => {
        if (flipSelect) return alert("패 방향을 먼저 확정하세요!");
        if (selected.has(i)) selected.delete(i);
        else selected.add(i);
        renderHand();
      };
    }

    wrap.appendChild(drawScoutCard(c.top, c.bottom));
    handArea.appendChild(wrap);

    if (allowInsert) {
      handArea.appendChild(createInsertButton(i + 1));
    }
  });
}

// ======================================================
// TABLE RENDER (양 끝만 SCOUT 가능)
// ======================================================
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#555">(비어 있음)</span>`;
    return;
  }

  tableCards.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "table-card-wrapper";

    wrap.appendChild(drawScoutCard(c.top, c.bottom));

    const canScout =
      myTurn &&
      !flipSelect &&
      scoutMode &&
      (
        tableCards.length === 1 ||
        (tableCards.length === 2 && idx <= 1) ||
        (tableCards.length >= 3 && (idx === 0 || idx === tableCards.length - 1))
      );

    if (canScout) {
      wrap.classList.add("scout-glow");

      const btn = document.createElement("button");
      btn.className = "take-btn";
      btn.innerText = "가져오기";

      btn.onclick = () => {
        scoutTargetSide = (idx === 0 ? "left" : "right");
        scoutModal.classList.remove("hidden");
      };

      wrap.appendChild(btn);
    }

    tableArea.appendChild(wrap);
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
};

// ======================================================
// SCOUT 버튼
// ======================================================
scoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;
  if (tableCards.length === 0) return;

  scoutMode = true;
  renderTable();
};

// ======================================================
// SCOUT MODAL
// ======================================================
modalClose.onclick = () => scoutModal.classList.add("hidden");

modalKeep.onclick = () => {
  scoutFlip = false;
  scoutModal.classList.add("hidden");
  renderHand();
};

modalReverse.onclick = () => {
  scoutFlip = true;
  scoutModal.classList.add("hidden");
  renderHand();
};

// ======================================================
// TURN CHANGE
// ======================================================
socket.on("turnChange", (uid) => {
  myTurn = uid === window.permUid;

  scoutMode = false;
  renderTable();
  renderHand();
});

// ======================================================
// SOCKET HANDLERS
// ======================================================
socket.on("playerListUpdate", (p) => {
  gamePlayers = p;          // ✔ READY LED 정상작동
  renderPlayers();
});

socket.on("roundStart", ({ round, players: p }) => {
  gamePlayers = p;
  tableCards = [];
  selected.clear();

  flipSelect = true;
  flipReversed = false;
  scoutMode = false;

  flipSelectArea.classList.remove("hidden");

  renderPlayers();
  renderTable();
  renderHand();

  roundInfo.innerText = `라운드 ${round}`;
});

socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  renderHand();
});

socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});
