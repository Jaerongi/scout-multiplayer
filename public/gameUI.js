// =====================================================
// GAME UI — 옵션B 최종 안정본 (사용자 요구 반영 완전체)
// =====================================================

import { drawScoutCard } from "./cardEngine.js";

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

// Flip buttons
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

let usedShowScout = false;

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
// FLIP
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

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== arr[i - 1] + 1) {
      return alert("연속된 카드를 선택해야 합니다.");
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

  usedShowScout = true;    

  scoutShowMode = true;
  scoutMode = true;
  insertMode = false;

  cancelShowScoutBtn.classList.remove("hidden");
  cancelShowScoutBtn.disabled = false;

  scoutBtn.disabled = true;
  scoutBtn.style.opacity = "0.4";

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
  if (!myTurn || flipSelect || usedShowScout) return;
  if (tableCards.length === 0) return;

  scoutMode = true;
  renderTable();
};

// -----------------------------------------------------
// SCOUT Modal
// -----------------------------------------------------
modalClose.onclick = () => scoutModal.classList.add("hidden");

modalKeep.onclick = () => {
  scoutModal.classList.add("hidden");

  insertMode = true;
  insertCardInfo = { side: scoutTargetSide, flip: false };

  scoutMode = false;
  renderHand();
  renderTable();
};

modalReverse.onclick = () => {
  scoutModal.classList.add("hidden");

  insertMode = true;
  insertCardInfo = { side: scoutTargetSide, flip: true };

  scoutMode = false;
  renderHand();
  renderTable();
};

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
    socket.emit("cancelShowScout", {
      roomId,
      permUid: window.permUid,
    });
    showFailModal.remove();
  };

  document.getElementById("closeShowBtn").onclick = () => {
    showFailModal.remove();
  };
});

// -----------------------------------------------------
// 취소 버튼
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

  renderHand();
  renderTable();
  updateButtons();
};

// -----------------------------------------------------
// 되돌리기 완료
// -----------------------------------------------------
socket.on("cancelShowScoutDone", () => {
  selected.clear();
  insertMode = false;

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
// TURN CHANGE ★★ (중복 제거 + SCOUT 복구 포함)
// -----------------------------------------------------
socket.on("turnChange", (uid) => {
  myTurn = uid === window.permUid;

  scoutMode = false;
  insertMode = false;

  // ⭐ 내 턴이 도착했을 때 SCOUT 자동 복구
  if (myTurn && !scoutShowMode && !usedShowScout) {
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
