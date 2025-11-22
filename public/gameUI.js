// =====================================================
// GAME UI — OPTION B (FINAL ABSOLUTE STABLE BUILD)
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
// STATE (🔥 usedShowScout per-player 구조로 변경)
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

let usedShowScout = {}; // ⭐ 플레이어별 SHOW&SCOUT 사용 기록

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
// RENDER HAND
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

    // ⭐ 가져오기 버튼 조건 (완전 정리됨)
    const canScout =
      myTurn &&
      !flipSelect &&
      (scoutMode || scoutShowMode) &&
      !insertMode &&
      !usedShowScout[window.permUid] &&
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
// ----------------------------------------------------
// 하이라이트
function highlightTurn(targetUid) {
  const boxes = gamePlayerList.children;

  Object.values(players).forEach((player, i) => {
    const box = boxes[i];
    if (!box) return;

    if (player.uid === targetUid) box.classList.add("turnGlow");
    else box.classList.remove("turnGlow");
  });
}



// -----------------------------------------------------
// BUTTON CONTROL
// -----------------------------------------------------
function updateButtons() {
  const active = myTurn && !insertMode;  // ← flipSelect 제거

  const set = (btn, on) => {
    btn.disabled = !on;
    btn.style.opacity = on ? "1" : "0.4";
  };

  // SHOW는 항상 가능 (내 턴이면)
  set(showBtn, active);

  // SHOW&SCOUT는 라운드당 1번 (플레이어별)
  set(showScoutBtn, active && !usedShowScout[window.permUid]);

  // 일반 SCOUT
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
  renderHand();
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
    if (arr[i] !== arr[i - 1] + 1) return alert("연속된 카드를 선택해야 합니다.");
  }

  const chosen = arr.map((i) => disp[i]);

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen,
  });
};

// -----------------------------------------------------
// SHOW & SCOUT — 라운드당 1번
// -----------------------------------------------------
showScoutBtn.onclick = () => {
  if (!myTurn || flipSelect || usedShowScout[window.permUid]) return;

  usedShowScout[window.permUid] = true;

  scoutShowMode = true;
  scoutMode = true;
  insertMode = false;

  cancelShowScoutBtn.classList.remove("hidden");

  renderTable();

  socket.emit("startShowScout", {
    roomId,
    permUid: window.permUid,
  });
};

// -----------------------------------------------------
// 일반 SCOUT
// -----------------------------------------------------
scoutBtn.onclick = () => {
  if (!myTurn || flipSelect || usedShowScout[window.permUid]) return;
  if (tableCards.length === 0) return;

  scoutMode = true;
  renderTable();
};

// -----------------------------------------------------
// SCOUT Modal — 그대로/반대로
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
// SHOW 실패 → 되돌리기 모달
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
// 취소 버튼 — SHOW&SCOUT 완전 리셋
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
// 서버에서 SHOW&SCOUT 취소 완료
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

// SHOW&SCOUT 시작
socket.on("enterScoutMode", () => {
  scoutShowMode = true;
  renderTable();
});

// -----------------------------------------------------
// ROUND START — 전부 초기화
// -----------------------------------------------------
socket.on("roundStart", ({ round, players: p, turnOrder: t }) => {
  players = p;
  turnOrder = t;

  usedShowScout = {}; // ⭐ 라운드 시작 시 초기화

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
// TURN CHANGE — 버튼/상태 정상화 핵심
// -----------------------------------------------------
socket.on("turnChange", (uid) => {
  myTurn = uid === window.permUid;

  // 매 턴 SCOUT 관련 플래그 초기화
  scoutMode = false;
  insertMode = false;
  selected.clear();

  // ⭐ SHOW&SCOUT 모드 초기화 (턴 넘어가면 자동 해제)
  scoutShowMode = false;

  // ⭐ 내 턴일 때 SCOUT / SHOW / SHOW&SCOUT 정상 활성화
  if (myTurn) {
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

// -----------------------------------------------------
// GAME OVER
// -----------------------------------------------------
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

