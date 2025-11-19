// ======================================================
// GAME UI — SHOW & SCOUT FULL LOGIC (최종 완전체)
// ======================================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// DOM 참조
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

let scoutMode = false;        // 일반 SCOUT 모드
let scoutShowMode = false;    // SHOW & SCOUT 전용 모드

let scoutTargetSide = null;

let insertMode = false;
let insertCardInfo = null;

let showFailModal = null;


// ======================================================
// 플레이어 목록 렌더링 (turnOrder 기반)
// ======================================================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  const order = players.turnOrder || Object.keys(players);

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
// 손패 렌더링
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

  disp.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    const selectable =
      !flipSelect &&
      !insertMode &&
      (true);

    if (selectable) {
      if (selected.has(i)) wrap.classList.add("selected");

      wrap.onclick = () => {
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

    let canScout =
      myTurn &&
      !flipSelect &&
      (scoutMode || scoutShowMode) &&
      (tableCards.length === 1 || idx === 0 || idx === tableCards.length - 1);

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
// TURN 표시
// ======================================================
function highlightTurn(uid) {
  const order = players.turnOrder || Object.keys(players);
  const boxes = gamePlayerList.children;

  order.forEach((id, index) => {
    if (id === uid) boxes[index].classList.add("turnGlow");
    else boxes[index].classList.remove("turnGlow");
  });
}


// ======================================================
// 버튼 활성화
// ======================================================
function updateActionButtons() {
  const active = myTurn && !flipSelect;

  showBtn.disabled = !active;
  scoutBtn.disabled = !active;
  showScoutBtn.disabled = !active;

  showBtn.style.opacity = active ? "1" : "0.4";
  scoutBtn.style.opacity = active ? "1" : "0.4";
  showScoutBtn.style.opacity = active ? "1" : "0.4";
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
// SHOW & SCOUT — SCOUT 모드 시작
// ======================================================
showScoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;

  scoutShowMode = true;
  scoutMode = false;

  socket.emit("startShowScout", {
    roomId,
    permUid: window.permUid,
  });
};


// ======================================================
// SHOW & SCOUT 실패 → 취소 모달
// ======================================================
socket.on("showFailed", () => {
  if (showFailModal) showFailModal.remove();

  showFailModal = document.createElement("div");
  showFailModal.className = "modal";

  showFailModal.innerHTML = `
    <div class="modal-box">
      <p>SHOW에 실패했습니다.</p>
      <p>가져온 카드를 되돌릴까요?</p>
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
  renderHand();
  renderTable();
});


// ======================================================
// SCOUT 모드 진입 (SHOW&SCOUT 포함)
// ======================================================
socket.on("enterScoutMode", (uid) => {
  if (uid === window.permUid) {
    scoutShowMode = true;
    scoutMode = false;
  }
});


// ======================================================
// SCOUT — flip 모달
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
// SOCKET EVENTS
// ======================================================

// 플레이어 목록 업데이트
socket.on("playerListUpdate", (data) => {
  players = data.players;
  players.turnOrder = data.turnOrder;

  renderPlayers();
});


// 라운드 시작
socket.on("roundStart", ({ round, players: p, turnOrder }) => {
  players = p;
  players.turnOrder = turnOrder;

  tableCards = [];
  myHand = [];
  selected.clear();

  flipSelect = true;
  flipReversed = false;

  scoutMode = false;
  scoutShowMode = false;
  insertMode = false;

  flipSelectArea.classList.remove("hidden");

  renderPlayers();
  renderTable();
  renderHand();

  roundInfo.innerText = `라운드 ${round}`;
  updateActionButtons();
});


// 내 손패 업데이트
socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  insertMode = false;

  renderHand();
  updateActionButtons();
});


// 테이블 변경
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


// 라운드 종료
socket.on("roundEnd", ({ winner, players }) => {
  const name = players[winner].nickname;

  const div = document.createElement("div");
  div.className = "modal";

  div.innerHTML = `
    <div class="modal-box">
      <h2>라운드 승자</h2>
      <h1>${name}</h1>
    </div>
  `;
  document.body.appendChild(div);

  setTimeout(() => div.remove(), 3000);
});


// 게임 종료
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
