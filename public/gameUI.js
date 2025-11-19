// ======================================================
// GAME UI — SHOW & SCOUT 확장 완전체 (server.js와 100% 연동)
// ======================================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// ============================================================================
// DOM
// ============================================================================
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

// 액션 버튼
const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// 방향 선택 UI
const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

// SCOUT 모달
const scoutModal = document.getElementById("scoutModal");
const modalKeep = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose = document.getElementById("modalClose");

// ============================================================================
// STATE
// ============================================================================
let players = {};
let turnOrder = [];

let tableCards = [];
let myHand = [];

let selected = new Set();
let myTurn = false;

// 패 방향
let flipSelect = true;
let flipReversed = false;

// SCOUT 종류 구분
let scoutMode = false;        // 일반 SCOUT
let scoutShowMode = false;    // SHOW&SCOUT

// SCOUT 가져오기 위치/뒤집기 상태
let scoutTargetSide = null;

// SCOUT 삽입 모드
let insertMode = false;
let insertCardInfo = null;

// SHOW 실패 모달
let showFailModal = null;

// ============================================================================
// 플레이어 목록 렌더링
// ============================================================================
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

// ============================================================================
// 손패 렌더링
// ============================================================================
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

    // 선별 가능 조건
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

// ============================================================================
// 테이블 렌더링
// ============================================================================
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
      (tableCards.length === 1 ||
        idx === 0 ||
        idx === tableCards.length - 1);

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

// ============================================================================
// 턴 표시
// ============================================================================
function highlightTurn(uid) {
  const order = turnOrder.length ? turnOrder : Object.keys(players);
  const boxes = gamePlayerList.children;

  order.forEach((id, i) => {
    if (!boxes[i]) return;
    if (id === uid) boxes[i].classList.add("turnGlow");
    else boxes[i].classList.remove("turnGlow");
  });
}

// ============================================================================
// 버튼 활성화 제어
// ============================================================================
function updateButtons() {
  const active = myTurn && !flipSelect;

  const set = (btn) => {
    btn.disabled = !active;
    btn.style.opacity = active ? "1" : "0.4";
  };

  set(showBtn);
  set(scoutBtn);
  set(showScoutBtn);
}

// ============================================================================
// SHOW
// ============================================================================
showBtn.onclick = () => {
  if (!myTurn || flipSelect) return;

  const disp = getDisplayedHand();
  const chosen = [...selected].map((i) => disp[i]);
  if (chosen.length === 0) return alert("카드를 선택하세요.");

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen,
  });
};

// ============================================================================
// SHOW & SCOUT — SCOUT MODE 진입
// ============================================================================
showScoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;

  scoutMode = false;
  scoutShowMode = true;

  socket.emit("startShowScout", {
    roomId,
    permUid: window.permUid,
  });
};

// ============================================================================
// SHOW 실패 → 취소 모달
// ============================================================================
socket.on("showFailed", () => {
  if (showFailModal) showFailModal.remove();

  showFailModal = document.createElement("div");
  showFailModal.className = "modal";

  showFailModal.innerHTML = `
    <div class="modal-box">
      <p>SHOW 실패!</p>
      <p>가져온 카드를 원래대로 되돌릴까요?</p>
      <br />
      <button id="cancelShowBtn" class="btn-orange">취소하기</button>
      <br /><br />
      <button id="closeShowBtn" class="btn-sub">닫기</button>
    </div>
  `;

  document.body.appendChild(showFailModal);

  // 복구 요청
  document.getElementById("cancelShowBtn").onclick = () => {
    socket.emit("cancelShowScout", {
      roomId,
      permUid: window.permUid,
    });
    showFailModal.remove();
    showFailModal = null;
  };

  // 그냥 닫기
  document.getElementById("closeShowBtn").onclick = () => {
    showFailModal.remove();
    showFailModal = null;
  };
});

// 복구 완료 → SCOUTSHOW 모드 유지
socket.on("cancelShowScoutDone", () => {
  scoutShowMode = true;
  selected.clear();

  renderHand();
  renderTable();
});

// ============================================================================
// SCOUT MODE 진입
// ============================================================================
socket.on("enterScoutMode", (uid) => {
  if (uid === window.permUid) {
    scoutShowMode = true;
    scoutMode = false;
  }
});

// ============================================================================
// SCOUT FLIP 모달
// ============================================================================
modalClose.onclick = () => scoutModal.classList.add("hidden");

modalKeep.onclick = () => {
  scoutModal.classList.add("hidden");

  insertMode = true;
  insertCardInfo = { side: scoutTargetSide, flip: false };

  renderHand();
};

modalReverse.onclick = () => {
  scoutModal.classList.add("hidden");

  insertMode = true;
  insertCardInfo = { side: scoutTargetSide, flip: true };

  renderHand();
};

// ============================================================================
// 패 방향 선택
// ============================================================================
flipToggleBtn.onclick = () => {
  flipReversed = !flipReversed;
  renderHand();
};

flipConfirmBtn.onclick = () => {
  flipSelect = false;
  flipSelectArea.classList.add("hidden");
  updateButtons();
};

// ============================================================================
// SOCKET EVENTS
// ============================================================================

// 플레이어 목록 갱신
socket.on("playerListUpdate", (data) => {
  players = data.players;
  turnOrder = data.turnOrder;

  renderPlayers();
});

// 라운드 시작
socket.on("roundStart", ({ round, players: p, turnOrder: t }) => {
  players = p;
  turnOrder = t;

  tableCards = [];
  myHand = [];
  selected.clear();

  flipSelect = true;
  flipReversed = false;

  scoutMode = false;
  scoutShowMode = false;
  insertMode = false;
  scoutTargetSide = null;
  insertCardInfo = null;

  flipSelectArea.classList.remove("hidden");

  renderPlayers();
  renderTable();
  renderHand();

  roundInfo.innerText = `라운드 ${round}`;
  updateButtons();
});

// 손패 갱신
socket.on("yourHand", (hand) => {
  myHand = hand;
  insertMode = false;
  selected.clear();

  renderHand();
  updateButtons();
});

// 테이블 갱신
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

// 턴 변경
socket.on("turnChange", (uid) => {
  myTurn = uid === window.permUid;

  scoutMode = false;
  scoutShowMode = false;
  insertMode = false;
  scoutTargetSide = null;
  insertCardInfo = null;
  selected.clear();

  if (showFailModal) {
    showFailModal.remove();
    showFailModal = null;
  }

  scoutModal.classList.add("hidden");

  highlightTurn(uid);
  renderTable();
  renderHand();
  updateButtons();
});

// 라운드 종료
socket.on("roundEnd", ({ winner, players }) => {
  const div = document.createElement("div");
  div.className = "modal";

  div.innerHTML = `
    <div class="modal-box">
      <h2>라운드 승자</h2>
      <h1>${players[winner].nickname}</h1>
    </div>
  `;

  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2000);
});

// 게임 종료
socket.on("gameOver", ({ winner, players }) => {
  const div = document.createElement("div");
  div.className = "modal";

  div.innerHTML = `
    <div class="modal-box">
      <h2>최종 우승자 🎉</h2>
      <h1>${players[winner].nickname}</h1>
      <br />
      <button id="restartBtn" class="btn-main">재경기</button>
    </div>
  `;

  document.body.appendChild(div);

  document.getElementById("restartBtn").onclick = () => {
    div.remove();
    socket.emit("startGame", {
      roomId,
      permUid: window.permUid,
    });
  };
});
