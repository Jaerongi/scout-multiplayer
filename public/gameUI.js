// =====================================================
// GAME UI — OPTION B (FINAL CLEAN STABLE BUILD)
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

let scoutMode = false;        // 일반 SCOUT
let scoutShowMode = false;    // SHOW & SCOUT 진행중
let insertMode = false;       // 가져온 카드 넣기

let usedShowScout = false;    // ⭐ 라운드당 1회 제한

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

  // 앞쪽 +넣기
  if (insertMode) handArea.appendChild(createInsertButton(0));

  // 카드 렌더링
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

    // 뒤쪽 +넣기 버튼
    if (insertMode) handArea.appendChild(createInsertButton(idx + 1));
  });
}
// -----------------------------------------------------
// RENDER : TABLE
// -----------------------------------------------------
function renderTable() {
  tableArea.innerHTML = "";

  // 테이블이 비었을 때
  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#777">(비어 있음)</span>`;
    return;
  }

  tableCards.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "table-card-wrapper";
    wrap.appendChild(drawScoutCard(c.top, c.bottom));

    // ⭐ 가져오기 버튼을 표시할 조건
    //  - 내 턴
    //  - flipSelect 끝남
    //  - SCOUT 또는 SHOW&SCOUT 모드 중
    //  - insertMode 아님
    //  - usedShowScout == false (SHOW&SCOUT 후 1회 제한)
    //  - 테이블 양 끝 카드만 가능
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

  // 일반 SHOW는 항상 가능
  set(showBtn, active);

  // SHOW&SCOUT → 1회성
  set(showScoutBtn, active && !usedShowScout);

  // SCOUT → insertMode 또는 SHOW&SCOUT 중에는 비활성화
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

  // 선택된 카드 index 정렬
  const arr = [...selected].sort((a, b) => a - b);

  if (arr.length === 0) return alert("카드를 선택하세요.");

  // 연속된 카드만 제출 가능
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== arr[i - 1] + 1) {
      return alert("연속된 카드를 선택해야 합니다!");
    }
  }

  // 선택한 카드 구성
  const chosen = arr.map((i) => disp[i]);

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen,
  });
};

// -----------------------------------------------------
// SHOW & SCOUT (라운드당 1회)
// -----------------------------------------------------
showScoutBtn.onclick = () => {
  if (!myTurn || flipSelect || usedShowScout) return;

  usedShowScout = true;             // ⭐ 이번 라운드 사용 처리

  scoutShowMode = true;             // SHOW&SCOUT 모드 진입
  scoutMode = true;                 // 가져오기 활성화
  insertMode = false;

  // SCOUT 버튼 비활성화
  scoutBtn.disabled = true;
  scoutBtn.style.opacity = "0.4";

  // 다시 못 누르게 SHOW&SCOUT 버튼 비활성화
  showScoutBtn.disabled = true;
  showScoutBtn.style.opacity = "0.4";

  // 취소 버튼 표시
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
  if (!myTurn || flipSelect || usedShowScout) return;
  if (tableCards.length === 0) return;

  scoutMode = true;
  renderTable();
};

// -----------------------------------------------------
// SCOUT Modal (그대로/반대로 가져오기)
// -----------------------------------------------------
modalClose.onclick = () => scoutModal.classList.add("hidden");

function enterInsertMode(flip) {
  scoutModal.classList.add("hidden");

  insertMode = true;
  insertCardInfo = {
    side: scoutTargetSide,
    flip,
  };

  scoutMode = false; // SCOUT 해제

  // SHOW&SCOUT 이미 1회 사용 → 계속 비활성화
  showScoutBtn.disabled = true;
  showScoutBtn.style.opacity = "0.4";

  renderHand();
  renderTable();
}

// 그대로 가져오기
modalKeep.onclick = () => enterInsertMode(false);

// 반대로 가져오기
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
// 취소 버튼 → SHOW&SCOUT 완전 리셋
// -----------------------------------------------------
cancelShowScoutBtn.onclick = () => {
  scoutMode = false;
  scoutShowMode = false;
  insertMode = false;
  selected.clear();

  // 라운드에서 SHOW&SCOUT 다시 사용 가능
  usedShowScout = false;

  cancelShowScoutBtn.classList.add("hidden");

  // SCOUT 버튼 활성화 복구
  scoutBtn.disabled = false;
  scoutBtn.style.opacity = "1";

  // SHOW&SCOUT도 다시 활성화
  showScoutBtn.disabled = false;
  showScoutBtn.style.opacity = "1";

  renderHand();
  renderTable();
  updateButtons();
};

// -----------------------------------------------------
// 서버에서 SHOW&SCOUT 취소 복구 완료
// -----------------------------------------------------
socket.on("cancelShowScoutDone", () => {
  selected.clear();
  insertMode = false;

  // SHOW&SCOUT 모드 지속 (다시 SHOW 가능)
  scoutShowMode = true;

  cancelShowScoutBtn.classList.remove("hidden");

  showScoutBtn.disabled = false;
  showScoutBtn.style.opacity = "1";

  renderHand();
  renderTable();
});

// -----------------------------------------------------
// SOCKET EVENTS (기본 수신 처리)
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
// ======================================================
// ROUND START (패 리셋 / 버튼 리셋)
// ======================================================
socket.on("roundStart", ({ round, players: p, turnOrder: t }) => {
  players = p;
  turnOrder = t;

  // SHOW&SCOUT은 라운드 시작 시 다시 사용 가능
  usedShowScout = false;

  tableCards = [];
  selected.clear();

  scoutMode = false;
  scoutShowMode = false;
  insertMode = false;

  // 패 방향 초기화
  flipReversed = false;
  flipSelect = true;

  // 취소 버튼 숨기기
  cancelShowScoutBtn.classList.add("hidden");

  // 방향 선택 UI 표시
  flipSelectArea.classList.remove("hidden");

  renderPlayers();
  renderTable();
  renderHand();

  roundInfo.innerText = `라운드 ${round}`;
  updateButtons();
});

// ======================================================
// TURN CHANGE
// ======================================================
socket.on("turnChange", (uid) => {
  myTurn = uid === window.permUid;

  // 턴 변경 시 SCOUT/SCOUTSHOW 모드 초기화
  scoutMode = false;
  insertMode = false;

  // ⭐ SHOW&SCOUT이 아닌 상황이면 SCOUT 자동 복구
  if (myTurn && !scoutShowMode) {
    scoutBtn.disabled = false;
    scoutBtn.style.opacity = "1";
  }

  highlightTurn(uid);
  renderTable();
  renderHand();
  updateButtons();
});

// ======================================================
// ROUND END
// ======================================================
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

// ======================================================
// GAME OVER
// ======================================================
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
