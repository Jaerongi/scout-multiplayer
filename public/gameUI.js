// ======================================================
// GAME UI — SHOW & SCOUT + CANCEL + TURN FIX FULL VERSION
// ======================================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// DOM
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

// Action Buttons
const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// Flip Select
const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

// SCOUT Modal
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

let scoutMode = false;
let scoutTargetSide = null;

let insertMode = false;
let insertCardInfo = null;

let showFailModal = null;


// ======================================================
// 플레이어 목록 렌더링 (turnOrder 우선 적용)
// ======================================================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  // 🔥 turnOrder 우선 렌더링
  let order = players.turnOrder;
  if (!order) order = Object.keys(players);

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


// ======================================================
// 내 패 렌더링
// ======================================================
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

  disp.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    if (!insertMode) {
      if (selected.has(i)) wrap.classList.add("selected");

      wrap.onclick = () => {
        if (flipSelect) return alert("패 방향을 먼저 확정하세요!");
        if (insertMode) return;

        if (selected.has(i)) selected.delete(i);
        else selected.add(i);

        renderHand();
      };
    }

    wrap.appendChild(drawScoutCard(c.top, c.bottom));
    handArea.appendChild(wrap);

    if (insertMode) handArea.appendChild(createInsertButton(i + 1));
  });
}


// ======================================================
// 테이블 렌더링
// ======================================================
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
      scoutMode &&
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


// ======================================================
// 턴 표시
// ======================================================
function highlightTurn(uid) {
  const order = players.turnOrder || Object.keys(players);
  const boxes = gamePlayerList.children;

  order.forEach((id, i) => {
    if (id === uid) boxes[i].classList.add("turnGlow");
    else boxes[i].classList.remove("turnGlow");
  });
}


// ======================================================
// 버튼 활성화
// ======================================================
function updateActionButtons() {
  const active = myTurn && !flipSelect;
  [showBtn, scoutBtn, showScoutBtn].forEach((btn) => {
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
  const chosen = Array.from(selected).map((i) => disp[i]);
  if (chosen.length === 0) return alert("카드를 선택하세요!");

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen,
  });
};


// ======================================================
// SHOW & SCOUT (SCOUT 보너스 자동 적용)
// ======================================================
showScoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;

  const disp = getDisplayedHand();
  const chosen = Array.from(selected).map((i) => disp[i]);
  if (chosen.length === 0) return alert("카드를 선택하세요!");

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen,
  });
};


// ======================================================
// SHOW 실패 → 취소 모달
// ======================================================
socket.on("showFailed", () => {
  if (showFailModal) showFailModal.remove();

  showFailModal = document.createElement("div");
  showFailModal.className = "modal";
  showFailModal.innerHTML = `
    <div class="modal-box">
      <p>SHOW 할 수 없습니다.</p>
      <p style="margin-top:10px;">가져온 카드를 되돌릴까요?</p>
      <br>
      <button id="cancelScoutBtn" class="btn-orange" style="width:120px;">취소</button>
      <br><br>
      <button id="closeFailBtn" class="btn-sub" style="width:120px;">닫기</button>
    </div>
  `;

  document.body.appendChild(showFailModal);

  document.getElementById("cancelScoutBtn").onclick = () => {
    socket.emit("cancelShowScout", {
      roomId,
      permUid: window.permUid,
    });
    showFailModal.remove();
    showFailModal = null;
  };

  document.getElementById("closeFailBtn").onclick = () => {
    showFailModal.remove();
    showFailModal = null;
  };
});


// ======================================================
// SCOUT MODE
// ======================================================
scoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;
  if (tableCards.length === 0) return;
  scoutMode = true;
  renderTable();
};


// ======================================================
// SCOUT Modal (flip 선택)
// ======================================================
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


// ======================================================
// 패 방향 선택
// ======================================================
flipToggleBtn.onclick = () => {
  flipReversed = !flipReversed;
  renderHand();
};

flipConfirmBtn.onclick = () => {
  flipSelect = false;
  flipSelectArea.classList.add("hidden");
  updateActionButtons();
};


// ======================================================
// SOCKET: playerListUpdate
// ======================================================
socket.on("playerListUpdate", (data) => {
  // data가 players만 있는 경우 or turnOrder 있는 경우 모두 호환
  if (data.players) {
    players = data.players;
    players.turnOrder = data.turnOrder || players.turnOrder;
  } else {
    players = data;
  }

  renderPlayers();
});


// ======================================================
// roundStart
// ======================================================
socket.on("roundStart", ({ round, players: p, startingPlayer }) => {
  players = p;
  players.turnOrder = Object.keys(p); // fallback

  tableCards = [];
  selected.clear();

  flipSelect = true;
  flipReversed = false;

  scoutMode = false;
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


// ======================================================
// yourHand
// ======================================================
socket.on("yourHand", (hand) => {
  myHand = hand;

  // SCOUT 후 선택 가능 상태로 복귀
  insertMode = false;
  scoutMode = false;
  scoutTargetSide = null;
  insertCardInfo = null;

  selected.clear();

  renderHand();
  updateActionButtons();
});



// ======================================================
// tableUpdate
// ======================================================
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
  updateActionButtons();
});


// ======================================================
// turnChange (🔥 SCOUT 상태 완전 초기화)
// ======================================================
socket.on("turnChange", (uid) => {
  myTurn = uid === window.permUid;

  // 🔥 SCOUT 관련 UI 상태 초기화
  scoutMode = false;
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


// ======================================================
// 라운드 종료 / 게임 종료
// ======================================================
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
  setTimeout(() => div.remove(), 3000);
});

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
    socket.emit("startGame", {
      roomId,
      permUid: window.permUid,
    });
  };
});

