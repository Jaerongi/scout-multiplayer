// ======================================================
// GAME UI — SHOW & SCOUT 완전체 안정화 버전
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

// 버튼
const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// 방향 선택 UI
const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

// SCOUT 모달 (그대로 가져오기/반대로 가져오기)
const scoutModal = document.getElementById("scoutModal");
const modalKeep = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose = document.getElementById("modalClose");

// ============================================================================
// STATE
// ============================================================================
let players = {};         // uid → player 데이터
let turnOrder = [];       // 서버에서 받은 플레이 순서

let tableCards = [];
let myHand = [];

let selected = new Set();
let myTurn = false;

let flipSelect = true;
let flipReversed = false;

// 일반 SCOUT 모드
let scoutMode = false;

// SHOW & SCOUT 모드 (SCOUT 후 SHOW까지)
let scoutShowMode = false;

// SCOUT 가져오기용 임시 상태
let scoutTargetSide = null;

// SCOUT 삽입 모드 (+넣기 버튼)
let insertMode = false;
let insertCardInfo = null;

let showFailModal = null;

// ============================================================================
// 플레이어 목록 렌더링 (turnOrder 기준)
// ============================================================================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  const order = turnOrder?.length ? turnOrder : Object.keys(players);

  order.forEach((uid) => {
    const p = players[uid];
    if (!p) return; // turnOrder에 잘못된 값 있으면 무시

    const box = document.createElement("div");
    box.className = "playerBox";
    if (!p.isOnline) box.classList.add("offlinePlayer");

    box.innerHTML = `
      <b>${p.nickname}</b><br>
      패: ${p.hand.length}장<br>
      점수: ${p.score}
    `;

    gamePlayerList.appendChild(box);
  });
}

// ============================================================================
// 손패 렌더링
// ============================================================================
function getDisplayedHand() {
  return flipReversed
    ? myHand.map(c => ({ top: c.bottom, bottom: c.top }))
    : myHand;
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  const disp = getDisplayedHand();

  // +넣기 버튼 생성
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

  disp.forEach((card, index) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    // 선택 가능 조건
    const selectable =
      !flipSelect &&
      !insertMode && 
      true;

    if (selectable) {
      if (selected.has(index)) wrap.classList.add("selected");

      wrap.onclick = () => {
        if (selected.has(index)) selected.delete(index);
        else selected.add(index);

        renderHand();
      };
    }

    wrap.appendChild(drawScoutCard(card.top, card.bottom));
    handArea.appendChild(wrap);

    if (insertMode) handArea.appendChild(createInsertButton(index + 1));
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

  tableCards.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "table-card-wrapper";
    wrap.appendChild(drawScoutCard(c.top, c.bottom));

    const canScout =
      myTurn &&
      !flipSelect &&
      (scoutMode || scoutShowMode) &&
      (tableCards.length === 1 || i === 0 || i === tableCards.length - 1);

    if (canScout) {
      wrap.classList.add("scout-glow");

      const btn = document.createElement("button");
      btn.className = "take-btn";
      btn.innerText = "가져오기";

      btn.onclick = () => {
        if (tableCards.length === 1) scoutTargetSide = "left";
        else if (i === 0) scoutTargetSide = "left";
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
    if (boxes[i]) {
      if (id === uid) boxes[i].classList.add("turnGlow");
      else boxes[i].classList.remove("turnGlow");
    }
  });
}

// ============================================================================
// 버튼 활성/비활성
// ============================================================================
function updateActionButtons() {
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
// SHOW 버튼
// ============================================================================
showBtn.onclick = () => {
  if (!myTurn || flipSelect) return;

  const disp = getDisplayedHand();
  const chosen = [...selected].map(i => disp[i]);

  if (chosen.length === 0) return alert("카드를 선택하세요.");

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen,
  });
};

// ============================================================================
// SHOW & SCOUT — SCOUT 모드 시작
// ============================================================================
showScoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;

  scoutShowMode = true;
  scoutMode = false;

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
      <p>SHOW에 실패했습니다.</p>
      <p>SCOUT으로 가져온 카드를 되돌릴까요?</p>
      <br>
      <button id="cancelBtn" class="btn-orange">취소</button>
      <br><br>
      <button id="closeBtn" class="btn-sub">닫기</button>
    </div>
  `;

  document.body.appendChild(showFailModal);

  document.getElementById("cancelBtn").onclick = () => {
    socket.emit("cancelShowScout", {
      roomId,
      permUid: window.permUid,
    });
    showFailModal.remove();
    showFailModal = null;
  };

  document.getElementById("closeBtn").onclick = () => {
    showFailModal.remove();
    showFailModal = null;
  };
});

socket.on("cancelShowScoutDone", () => {
  scoutShowMode = true;
  selected.clear();

  renderHand();
  renderTable();
});

// ============================================================================
// SCOUT 모드 진입
// ============================================================================
socket.on("enterScoutMode", (uid) => {
  if (uid === window.permUid) {
    scoutShowMode = true;
    scoutMode = false;
  }
});

// ============================================================================
// SCOUT 모달 (flip 선택)
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
// 방향 선택 UI
// ============================================================================
flipToggleBtn.onclick = () => {
  flipReversed = !flipReversed;
  renderHand();
};

flipConfirmBtn.onclick = () => {
  flipSelect = false;
  flipSelectArea.classList.add("hidden");
  updateActionButtons();
};

// ============================================================================
// SOCKET EVENTS
// ============================================================================

// 플레이어 목록 업데이트
socket.on("playerListUpdate", (data) => {
  players = data.players;
  turnOrder = data.turnOrder;   // players 안에 넣지 않는다 (중요)

  renderPlayers();
});

// 라운드 시작
socket.on("roundStart", ({ round, players: p, turnOrder: tOrder }) => {
  players = p;
  turnOrder = tOrder;

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
  updateActionButtons();
});

// 내 패 갱신
socket.on("yourHand", (hand) => {
  myHand = hand;
  insertMode = false;
  selected.clear();

  renderHand();
  updateActionButtons();
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
  updateActionButtons();
});

// 라운드 승리
socket.on("roundEnd", ({ winner, players }) => {
  const modal = document.createElement("div");
  modal.className = "modal";

  modal.innerHTML = `
    <div class="modal-box">
      <h2>라운드 승자</h2>
      <h1>${players[winner].nickname}</h1>
    </div>
  `;

  document.body.appendChild(modal);
  setTimeout(() => modal.remove(), 2500);
});

// 게임 종료
socket.on("gameOver", ({ winner, players }) => {
  const modal = document.createElement("div");
  modal.className = "modal";

  modal.innerHTML = `
    <div class="modal-box">
      <h2>최종 우승자 🎉</h2>
      <h1>${players[winner].nickname}</h1>
      <br>
      <button id="restartBtn" class="btn-main">재경기</button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("restartBtn").onclick = () => {
    modal.remove();
    socket.emit("startGame", { roomId, permUid: window.permUid });
  };
});
