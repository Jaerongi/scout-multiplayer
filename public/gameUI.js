// ======================================================
// GAME UI — SCOUT 방향 선택 / SHOW / SCOUT / TURN UI
// (삽입 모달 제거 + +넣기 버튼 + 라운드 승자 + 최종 우승)
// 21 57
// ======================================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// DOM Elements
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

// Buttons
const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// Flip UI
const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

// SCOUT modal
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
let scoutFlip = false;

// 삽입모드 (삽입 모달 없음)
let insertMode = false;
let insertCardInfo = null;

// ======================================================
// 플레이어 목록 렌더링
// ======================================================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
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
// 내 패 렌더링 (+넣기 버튼 적용)
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
    btn.className = "insert-btn";
    btn.innerText = "+ 넣기";

    btn.onclick = () => {
      insertMode = false;
      handArea.innerHTML = "";

      socket.emit("scout", {
        roomId,
        permUid: window.permUid,
        side: insertCardInfo.side,
        flip: insertCardInfo.flip,
        pos,
      });

      renderHand();
    };

    return btn;
  };

  // 첫 번째 위치
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

    // 카드 뒤에 +넣기 버튼
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
      (
        tableCards.length === 1 ||
        idx === 0 ||
        idx === tableCards.length - 1
      );

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
// 턴 하이라이트
// ======================================================
function highlightTurn(uid) {
  const arr = Object.values(players);
  const boxes = gamePlayerList.children;

  arr.forEach((p, i) => {
    if (p.uid === uid) boxes[i].classList.add("turnGlow");
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
// SCOUT 버튼
// ======================================================
scoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;
  if (tableCards.length === 0) return;

  scoutMode = true;
  renderTable();
};

// ======================================================
// SCOUT 모달 (삽입 모달 없이 insertMode만)
// ======================================================
modalClose.onclick = () => scoutModal.classList.add("hidden");

modalKeep.onclick = () => {
  scoutFlip = false;
  scoutModal.classList.add("hidden");

  insertMode = true;
  insertCardInfo = {
    side: scoutTargetSide,
    flip: false,
  };

  renderHand();
};

modalReverse.onclick = () => {
  scoutFlip = true;
  scoutModal.classList.add("hidden");

  insertMode = true;
  insertCardInfo = {
    side: scoutTargetSide,
    flip: true,
  };

  renderHand();
};

// ======================================================
// 패 방향 선택 UI
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
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

socket.on("roundStart", ({ round, players: p }) => {
  players = p;
  tableCards = [];
  selected.clear();

  flipSelect = true;
  flipReversed = false;
  scoutMode = false;
  insertMode = false;

  flipSelectArea.classList.remove("hidden");

  renderPlayers();
  renderTable();
  renderHand();

  roundInfo.innerText = `라운드 ${round}`;
  updateActionButtons();
});

socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  insertMode = false;
  renderHand();
  updateActionButtons();
});

socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
  updateActionButtons();
});

// ======================================================
// 라운드 종료 팝업
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

  setTimeout(() => {
    div.remove();
  }, 3000);
});

// ======================================================
// 최종 우승 팝업 + 재경기 버튼
// ======================================================
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

// ======================================================
// 턴 변경
// ======================================================
socket.on("turnChange", (uid) => {
  myTurn = uid === window.permUid;

  scoutMode = false;
  insertMode = false;

  highlightTurn(uid);
  renderTable();
  renderHand();
  updateActionButtons();
});
