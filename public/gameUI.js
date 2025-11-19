// =====================================================
// GAME UI — SHOW&SCOUT 완전 통합 안정본
// =====================================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// DOM
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// 패 방향 UI
const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

// SCOUT 모달
const scoutModal = document.getElementById("scoutModal");
const modalKeep = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose = document.getElementById("modalClose");

// SHOW&SCOUT 취소버튼 (index.html에 반드시 존재해야 함)
const cancelShowScoutBtn = document.getElementById("cancelShowScoutBtn");

// STATE
let players = {};
let tableCards = [];
let myHand = [];
let turnOrder = [];

let selected = new Set();
let myTurn = false;

let flipSelect = true;
let flipReversed = false;

let scoutMode = false;        // 일반 SCOUT
let scoutShowMode = false;    // SHOW&SCOUT 모드

let insertMode = false;       // SCOUT 후 +넣기 모드
let scoutTargetSide = null;
let insertCardInfo = null;

let showFailModal = null;

// =====================================================
// 플레이어 렌더링
// =====================================================
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

// =====================================================
// 손패 렌더링
// =====================================================
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

  if (insertMode) {
    handArea.appendChild(createInsertButton(0));
  }

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

    if (insertMode) {
      handArea.appendChild(createInsertButton(idx + 1));
    }
  });
}

// =====================================================
// 테이블 렌더링
// =====================================================
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

    // ⭐ SHOW&SCOUT 모드에서는 SCOUT glow 절대 표시 X
    const canScout =
      myTurn &&
      !flipSelect &&
      scoutMode &&             // ⭐ SCOUT 모드일 때만
      !insertMode &&
      (idx === 0 || idx === tableCards.length - 1);

    if (canScout) {
      wrap.classList.add("scout-glow");

      const btn = document.createElement("button");
      btn.className = "take-btn";
      btn.innerText = "가져오기";

      btn.onclick = () => {
        if (tableCards.length === 1) scoutTargetSide = "left";
        else if (idx === 0) scoutTargetSide = "left";
        else scoutTargetSide = "right";

        scoutModal.classList.remove("hidden");
      };

      wrap.appendChild(btn);
    }

    tableArea.appendChild(wrap);
  });
}

// =====================================================
// 턴 강조
// =====================================================
function highlightTurn(uid) {
  const order = turnOrder;
  const boxes = gamePlayerList.children;

  order.forEach((id, i) => {
    if (!boxes[i]) return;

    if (id === uid) boxes[i].classList.add("turnGlow");
    else boxes[i].classList.remove("turnGlow");
  });
}

// =====================================================
// 버튼 활성/비활성
// =====================================================
function updateButtons() {
  const active = myTurn && !flipSelect;

  const set = (btn, on) => {
    btn.disabled = !on;
    btn.style.opacity = on ? "1" : "0.4";
  };

  set(showBtn, active);
  set(scoutBtn, active && !scoutShowMode);
  set(showScoutBtn, active);
}

// =====================================================
// SHOW
// =====================================================
showBtn.onclick = () => {
  if (!myTurn || flipSelect) return;

  const disp = getDisplayedHand();
  const chosen = [...selected].map((i) => disp[i]);

  if (chosen.length === 0) return alert("카드를 선택하세요.");

  // 띄엄띄엄 선택 금지
  const sorted = [...selected].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      return alert("선택한 카드가 연속되지 않습니다.");
    }
  }

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen,
  });
};

// =====================================================
// SHOW & SCOUT 시작
// =====================================================
showScoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;

  scoutMode = false;
  scoutShowMode = true;
  insertMode = false;

  // ⭐ SCOUT 버튼 비활성화 (회색)
  scoutBtn.disabled = true;
  scoutBtn.style.opacity = "0.4";

  // ⭐ 취소버튼 즉시 활성화
  cancelShowScoutBtn.disabled = false;
  cancelShowScoutBtn.classList.remove("hidden");
  cancelShowScoutBtn.style.opacity = "1";

  renderTable();

  socket.emit("startShowScout", {
    roomId,
    permUid: window.permUid,
  });
};

// =====================================================
// 일반 SCOUT
// =====================================================
scoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;
  if (tableCards.length === 0) return;

  scoutMode = true;
  renderTable();
};

// =====================================================
// SCOUT 모달: 가져오기
// =====================================================
modalClose.onclick = () => scoutModal.classList.add("hidden");

modalKeep.onclick = () => {
  scoutModal.classList.add("hidden");

  insertMode = true;
  insertCardInfo = { side: scoutTargetSide, flip: false };

  scoutMode = false;
  renderTable();
  renderHand();
};

modalReverse.onclick = () => {
  scoutModal.classList.add("hidden");

  insertMode = true;
  insertCardInfo = { side: scoutTargetSide, flip: true };

  scoutMode = false;
  renderTable();
  renderHand();
};

// =====================================================
// SHOW 실패 → 되돌리기 모달
// =====================================================
socket.on("showFailed", () => {
  if (showFailModal) showFailModal.remove();

  showFailModal = document.createElement("div");
  showFailModal.className = "modal";

  showFailModal.innerHTML = `
    <div class="modal-box">
      <p>SHOW 실패!</p>
      <p style="margin-top:8px;">가져온 카드를 되돌릴까요?</p>
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
    showFailModal = null;
  };

  document.getElementById("closeShowBtn").onclick = () => {
    showFailModal.remove();
    showFailModal = null;
  };
});

// =====================================================
// SCOUT/SHOW&SCOUT 취소버튼 클릭
// =====================================================
cancelShowScoutBtn.onclick = () => {
  scoutShowMode = false;
  scoutMode = false;
  insertMode = false;
  selected.clear();

  // SCOUT 버튼 다시 활성화
  scoutBtn.disabled = false;
  scoutBtn.style.opacity = "1";

  showScoutBtn.disabled = false;
  showScoutBtn.style.opacity = "1";

  showBtn.disabled = false;
  showBtn.style.opacity = "1";

  cancelShowScoutBtn.classList.add("hidden");

  renderHand();
  renderTable();
  updateButtons();
};

// =====================================================
// 취소 복구 완료
// =====================================================
socket.on("cancelShowScoutDone", () => {
  insertMode = false;
  selected.clear();

  scoutShowMode = true;

  cancelShowScoutBtn.classList.remove("hidden");

  renderHand();
  renderTable();
});

// =====================================================
// SOCKET EVENTS
// =====================================================

socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

// 라운드 시작
socket.on("roundStart", ({ round, players: p, turnOrder: t }) => {
  players = p;
  turnOrder = t;

  tableCards = [];
  selected.clear();

  flipSelect = true;
  flipReversed = false;

  scoutMode = false;
  scoutShowMode = false;
  insertMode = false;

  cancelShowScoutBtn.classList.add("hidden");

  flipSelectArea.classList.remove("hidden");

  renderPlayers();
  renderTable();
  renderHand();

  roundInfo.innerText = `라운드 ${round}`;
  updateButtons();
});

// 손패 업데이트
socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  insertMode = false;

  renderHand();
  updateButtons();
});

// 테이블 업데이트
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
  updateButtons();
});

// 턴 변경
socket.on("turnChange", (uid) => {
  myTurn = uid === window.permUid;

  scoutMode = false;
  insertMode = false;

  highlightTurn(uid);
  renderTable();
  renderHand();
  updateButtons();
});

// SHOW&SCOUT 진입
socket.on("enterScoutMode", () => {
  scoutShowMode = true;
  scoutMode = false;

  cancelShowScoutBtn.classList.remove("hidden");

  renderTable();
});

// 라운드 종료 팝업
socket.on("roundEnd", ({ winner, players }) => {
  const name = players[winner].nickname;

  const div = document.createElement("div");
  div.className = "modal";

  div.innerHTML = `
    <div class="modal-box">
      <h2>라운드 승자</h2>
      <h1 style="margin-top:10px; font-size:32px;">${name}</h1>
    </div>
  `;

  document.body.appendChild(div);

  setTimeout(() => div.remove(), 2500);
});

// 게임 종료
socket.on("gameOver", ({ winner, players }) => {
  const name = players[winner].nickname;

  const div = document.createElement("div");
  div.className = "modal";

  div.innerHTML = `
    <div class="modal-box">
      <h2>최종 우승자 🎉</h2>
      <h1 style="margin-top:10px; font-size:32px;">${name}</h1>
      <br>
      <button id="restartBtn" class="btn-main">재경기 시작</button>
    </div>
  `;

  document.body.appendChild(div);

  document.getElementById("restartBtn").onclick = () => {
    div.remove();
    socket.emit("startGame", { roomId, permUid: window.permUid });
  };
});

// =====================================================
