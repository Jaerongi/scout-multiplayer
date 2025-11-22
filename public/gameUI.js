// =====================================================
// GAME UI — OPTION B (FINAL CLEAN STABLE BUILD)
// (SHOW&SCOUT 가져오기 버튼 표시 문제 완전 해결본)
// =====================================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// -----------------------------------------------------
// DOM ELEMENTS
// -----------------------------------------------------
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

// Buttons
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

let usedShowScout = false;    // ⭐ 가져오기 1회 제한

let scoutTargetSide = null;
let insertCardInfo = null;
let showFailModal = null;

// -----------------------------------------------------
// RENDER : PLAYERS
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
// RENDER : HAND
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

  // + 넣기 버튼 생성
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

  // 카드 출력
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
// RENDER : TABLE
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

    // 가져오기 버튼 표시 조건
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
// BUTTON CONTROL
// -----------------------------------------------------
function updateButtons() {
  const active = myTurn && !flipSelect && !insertMode;

  const set = (btn, on) => {
    btn.disabled = !on;
    btn.style.opacity = on ? "1" : "0.4";
  };

  // SHOW 가능
  set(showBtn, active);

  // SHOW&SCOUT → 가져오기 전까지만 가능
  set(showScoutBtn, active && !usedShowScout);

  // SCOUT → SHOW&SCOUT 상태에서는 잠금
  set(scoutBtn, active && !scoutShowMode && !usedShowScout);
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

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== arr[i - 1] + 1) {
      return alert("연속된 카드를 선택해야 합니다!");
    }
  }

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
showScoutBtn.onclick = () => {
  if (!myTurn || flipSelect || usedShowScout) return;

  // ❗ usedShowScout = false 유지해야 가져오기 버튼이 보임
  // 가져오기한 뒤(enterInsertMode)에서 true로 바꿈

  scoutShowMode = true;
  scoutMode = true;
  insertMode = false;

  // SCOUT 버튼 막기
  scoutBtn.disabled = true;
  scoutBtn.style.opacity = "0.4";

  cancelShowScoutBtn.classList.remove("hidden");

  renderTable();

  socket.emit("startShowScout", { roomId, permUid: window.permUid });
};

// -----------------------------------------------------
// SCOUT
// -----------------------------------------------------
scoutBtn.onclick = () => {
  if (!myTurn || flipSelect || usedShowScout) return;
  if (tableCards.length === 0) return;

  scoutMode = true;
  renderTable();
};

// -----------------------------------------------------
// SCOUT Modal → 실제로 패 가져오기
// -----------------------------------------------------
modalClose.onclick = () => scoutModal.classList.add("hidden");

function enterInsertMode(flip) {
  scoutModal.classList.add("hidden");

  insertMode = true;
  insertCardInfo = { side: scoutTargetSide, flip };

  scoutMode = false;

  // ⭐ 가져오기한 시점에서만 true
  usedShowScout = true;

  // 가져오면 테이블 버튼 즉시 제거됨
  renderHand();
  renderTable();
}

modalKeep.onclick = () => enterInsertMode(false);
modalReverse.onclick = () => enterInsertMode(true);

// -----------------------------------------------------
// SHOW 실패 → 되돌리기
// -----------------------------------------------------
socket.on("showFailed", () => {
  if (showFailModal) showFailModal.remove();

  showFailModal = document.createElement("div");
  showFailModal.className = "modal";

  showFailModal.innerHTML = `
    <div class="modal-box">
      <p>SHOW 실패!</p>
      <p>가져온 카드를 되돌릴까요?</p>
      <br>
      <button id="cancelShowBtn" class="btn-orange">되돌리기</button>
      <br><br>
      <button id="closeShowBtn" class="btn-sub">닫기</button>
    </div>
  `;

  document.body.appendChild(showFailModal);

  document.getElementById("cancelShowBtn").onclick = () => {
    socket.emit("cancelShowScout", { roomId, permUid: window.permUid });
    showFailModal.remove();
  };

  document.getElementById("closeShowBtn").onclick = () => {
    showFailModal.remove();
  };
});

// -----------------------------------------------------
// 취소 버튼 → SHOW&SCOUT 초기화
// -----------------------------------------------------
cancelShowScoutBtn.onclick = () => {
  scoutMode = false;
  scoutShowMode = false;
  insertMode = false;
  selected.clear();

  usedShowScout = false;

  cancelShowScoutBtn.classList.add("hidden");

  scoutBtn.disabled = false;
  scoutBtn.style.opacity = "1";

  showScoutBtn.disabled = false;
  showScoutBtn.style.opacity = "1";

  renderHand();
  renderTable();
  updateButtons();
};

// -----------------------------------------------------
// 서버 취소 완료
// -----------------------------------------------------
socket.on("cancelShowScoutDone", () => {
  selected.clear();
  insertMode = false;

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

  usedShowScout = false;

  tableCards = [];
  selected.clear();

  scoutMode = false;
  scoutShowMode = false;
  insertMode = false;

  flipReversed = false;
  flipSelect = true;

  cancelShowScoutBtn.classList.add("hidden");
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

  // 내 턴이면 SCOUT 복구(단, SHOW&SCOUT 모드 중이 아니면)
  if (myTurn && !scoutShowMode) {
    scoutBtn.disabled = false;
    scoutBtn.style.opacity = "1";
  }

  highlightTurn(uid);
  renderTable();
  renderHand();
  updateButtons();
});

// -----------------------------------------------------
// ROUND END / GAME OVER
// -----------------------------------------------------
socket.on("roundEnd", ({ winner, players }) => {
  const name = players[winner].nickname;

  const div = document.createElement("div");
  div.className = "modal";

  div.innerHTML = `
    <div class="modal-box">
      <h2>라운드 승자!</h2>
      <h1>${name}</h1>
    </div>
  `;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2500);
});

socket.on("gameOver", ({ winner, players }) => {
  const name = players[winner].nickname;

  const div = document.createElement("div");
  div.className = "modal";

  div.innerHTML = `
    <div class="modal-box">
      <h2>최종 우승자 🎉</h2>
      <h1>${name}</h1>
      <br>
      <button id="restartBtn" class="btn-main">재경기</button>
    </div>
  `;
  document.body.appendChild(div);

  document.getElementById("restartBtn").onclick = () => {
    div.remove();
    socket.emit("startGame", { roomId, permUid: window.permUid });
  };
});
