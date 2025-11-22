// =====================================================
// GAME UI — FINAL ULTRA-STABLE BUILD (A1~A5 FIXED)
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

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");
const cancelShowScoutBtn = document.getElementById("cancelShowScoutBtn");

const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

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

let usedShowScout = {}; // ★ 플레이어별 1회 제한

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
// RENDER HAND
// -----------------------------------------------------
function getDisplayedHand() {
  return flipReversed
    ? myHand.map(c => ({ top: c.bottom, bottom: c.top }))
    : myHand;
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  const disp = getDisplayedHand();

  const createInsertBtn = (pos) => {
    const btn = document.createElement("button");
    btn.className = "insert-btn";
    btn.innerText = "+ 넣기";
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

  if (insertMode) handArea.appendChild(createInsertBtn(0));

  disp.forEach((card, idx) => {
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

    wrap.appendChild(drawScoutCard(card.top, card.bottom));
    handArea.appendChild(wrap);

    if (insertMode) handArea.appendChild(createInsertBtn(idx + 1));
  });
}

// -----------------------------------------------------
// RENDER TABLE
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
      !insertMode &&
      !flipSelect &&
      (scoutMode || scoutShowMode) &&
      !usedShowScout[window.permUid] &&
      (idx === 0 || idx === tableCards.length - 1);

    if (canScout) {
      wrap.classList.add("scout-glow");

      const btn = document.createElement("button");
      btn.className = "take-btn";
      btn.innerText = "가져오기";

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
// BUTTON CONTROL
// -----------------------------------------------------
function updateButtons() {
  const active = myTurn && !flipSelect && !insertMode;

  const set = (btn, on) => {
    btn.disabled = !on;
    btn.style.opacity = on ? "1" : "0.4";
  };

  set(showBtn, active);
  set(showScoutBtn, active && !usedShowScout[window.permUid]);
  set(scoutBtn, active && !scoutShowMode && !usedShowScout[window.permUid]);
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
  renderHand();
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
      return alert("연속된 카드를 선택해야 합니다!");

  const chosen = arr.map(i => disp[i]);

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen,
  });
};

// -----------------------------------------------------
// SHOW & SCOUT (1회)
// -----------------------------------------------------
showScoutBtn.onclick = () => {
  if (!myTurn || flipSelect || usedShowScout[window.permUid]) return;

  usedShowScout[window.permUid] = true;

  scoutMode = true;
  scoutShowMode = true;
  insertMode = false;

  cancelShowScoutBtn.classList.remove("hidden");

  renderTable();

  socket.emit("startShowScout", {
    roomId,
    permUid: window.permUid,
  });
};

// -----------------------------------------------------
// SCOUT
// -----------------------------------------------------
scoutBtn.onclick = () => {
  if (!myTurn || flipSelect || usedShowScout[window.permUid]) return;
  if (tableCards.length === 0) return;

  scoutMode = true;
  renderTable();
};

// -----------------------------------------------------
// SCOUT Modal
// -----------------------------------------------------
modalClose.onclick = () => scoutModal.classList.add("hidden");

function enterInsertMode(flip) {
  scoutModal.classList.add("hidden");

  insertMode = true;
  insertCardInfo = { side: scoutTargetSide, flip };
  scoutMode = false;

  renderHand();
  renderTable();
}

modalKeep.onclick = () => enterInsertMode(false);
modalReverse.onclick = () => enterInsertMode(true);

// -----------------------------------------------------
// SHOW 실패
// -----------------------------------------------------
socket.on("showFailed", () => {
  alert("SHOW 불가능한 패입니다.");
});

// -----------------------------------------------------
// 취소 버튼
// -----------------------------------------------------
cancelShowScoutBtn.onclick = () => {
  scoutMode = false;
  scoutShowMode = false;
  insertMode = false;
  selected.clear();

  usedShowScout[window.permUid] = false;

  cancelShowScoutBtn.classList.add("hidden");

  renderHand();
  renderTable();
  updateButtons();
};

// -----------------------------------------------------
// 서버 → SHOW&SCOUT 취소 완료
// -----------------------------------------------------
socket.on("cancelShowScoutDone", () => {
  insertMode = false;
  selected.clear();

  scoutShowMode = true;

  cancelShowScoutBtn.classList.remove("hidden");

  renderHand();
  renderTable();
});

// -----------------------------------------------------
// SOCKET EVENTS
// -----------------------------------------------------
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  insertMode = false;
  renderHand();
  updateButtons();
});

socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
  updateButtons();
});

socket.on("enterScoutMode", () => {
  scoutShowMode = true;
  renderTable();
});

// -----------------------------------------------------
// ROUND START
// -----------------------------------------------------
socket.on("roundStart", ({ round, players: p, turnOrder: t }) => {
  players = p;
  turnOrder = t;

  usedShowScout = {};

  tableCards = [];
  selected.clear();

  scoutMode = false;
  scoutShowMode = false;
  insertMode = false;

  flipReversed = false;
  flipSelect = true;

  cancelShowScoutBtn.classList.remove("hidden");

  flipSelectArea.classList.remove("hidden");

  renderPlayers();
  renderTable();
  renderHand();

  roundInfo.innerText = `라운드 ${round}`;
  updateButtons();
});

// -----------------------------------------------------
// TURN CHANGE
// -----------------------------------------------------
socket.on("turnChange", (uid) => {
  myTurn = uid === window.permUid;

  scoutMode = false;
  insertMode = false;
  selected.clear();

  if (!scoutShowMode) {
    scoutBtn.disabled = false;
    scoutBtn.style.opacity = "1";
  }

  highlightTurn(uid);
  renderTable();
  renderHand();
  updateButtons();
});

// -----------------------------------------------------
// ROUND END
// -----------------------------------------------------
socket.on("roundEnd", ({ winner, players }) => {
  alert(`라운드 승자: ${players[winner].nickname}`);
});

// -----------------------------------------------------
// GAME OVER
// -----------------------------------------------------
socket.on("gameOver", ({ winner, players }) => {
  alert(`최종 우승자: ${players[winner].nickname}`);
});
