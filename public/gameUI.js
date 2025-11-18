// ======================================================
// GAME UI — FINAL PATCHED VERSION (요청 4개 모두 완료)
// ======================================================

import { drawScoutCard } from "./cardEngine.js";

// DOM
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

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

// 방향선택
let flipSelect = true;
let flipReversed = false;

// NEW — 스카우트 모드 (버튼을 눌러야 가져오기 버튼 표시)
let scoutMode = false;

// NEW — insert 모드 (패 사이 +버튼 유지 여부)
let insertMode = false;

// SCOUT 정보
let scoutTargetSide = null;
let scoutFlip = false;

// ======================================================
// PLAYER LIST
// ======================================================
function renderPlayers() {
  gamePlayerList.innerHTML = "";
  Object.values(players).forEach((p) => {
    const d = document.createElement("div");
    d.className = "playerBox";
    if (!p.isOnline) d.classList.add("offlinePlayer");

    d.innerHTML = `
      <b>${p.nickname}</b><br>
      패 ${p.hand.length}장<br>
      점수 ${p.score}
    `;
    gamePlayerList.appendChild(d);
  });
}

// ======================================================
// HAND
// ======================================================
function getDisplayedHand() {
  return flipReversed
    ? myHand.map((c) => ({ top: c.bottom, bottom: c.top }))
    : myHand;
}

function renderHand() {
  if (insertMode) return; // insert 중이면 손패를 다시 그리면 위치 버튼 사라짐

  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  const disp = getDisplayedHand();
  disp.forEach((c, i) => {
    const w = document.createElement("div");
    w.className = "card-wrapper";

    if (selected.has(i)) w.classList.add("selected");

    w.onclick = () => {
      if (flipSelect) return alert("패 방향 확정 먼저");
      if (selected.has(i)) selected.delete(i);
      else selected.add(i);
      renderHand();
    };

    w.appendChild(drawScoutCard(c.top, c.bottom));
    handArea.appendChild(w);
  });
}

// ======================================================
// TABLE (가져오기 버튼 + 네온테두리)
// ======================================================
function renderTable() {
  tableArea.innerHTML = "";

  const count = tableCards.length;
  if (count === 0) {
    tableArea.innerHTML = `<span style='color:#555'>(비어 있음)</span>`;
    return;
  }

  tableCards.forEach((card, idx) => {
    const wrap = document.createElement("div");
    wrap.style.textAlign = "center";
    wrap.style.marginBottom = "16px";

    wrap.appendChild(drawScoutCard(card.top, card.bottom));

    const isLeft = idx === 0;
    const isRight = idx === count - 1;

    // 누구한테나 보여줄 하이라이트
    let canTake = false;
    let side = null;

    if (count === 1) {
      canTake = true;
      side = "left";
    } else if (count === 2) {
      canTake = true;
      side = idx === 0 ? "left" : "right";
    } else if (count >= 3) {
      if (isLeft) { canTake = true; side = "left"; }
      if (isRight) { canTake = true; side = "right"; }
    }

    // 네온 테두리 (항상 보이게)
    if (canTake) wrap.classList.add("neon-border");
    else wrap.style.filter = "brightness(0.35)";

    // 가져오기 버튼 — 스카우트 모드 + 내 턴일 때만 보임
    if (myTurn && scoutMode && canTake && !flipSelect) {
      const btn = document.createElement("button");
      btn.innerText = "가져오기";
      btn.className = "btn-orange small";
      btn.style.marginTop = "10px";
      btn.style.display = "block";
      btn.style.marginLeft = "auto";
      btn.style.marginRight = "auto";

      btn.onclick = () => {
        scoutTargetSide = side;
        scoutModal.classList.remove("hidden");
      };

      wrap.appendChild(btn);
    }

    tableArea.appendChild(wrap);
  });
}

// ======================================================
// INSERT MODE (+ 버튼)
// ======================================================
function renderInsertButtons() {
  insertMode = true;

  document.querySelectorAll(".insert-btn").forEach((el) => el.remove());

  const cards = handArea.children;

  for (let i = 0; i <= cards.length; i++) {
    const btn = document.createElement("button");
    btn.innerText = "+";
    btn.className = "insert-btn";
    btn.style.margin = "6px";
    btn.style.padding = "5px 8px";

    btn.onclick = () => {
      insertMode = false;

      socket.emit("scout", {
        roomId,
        permUid: window.permUid,
        side: scoutTargetSide,
        flip: scoutFlip,
        pos: i,
      });

      document.querySelectorAll(".insert-btn").forEach((el) => el.remove());
    };

    if (i < cards.length) handArea.insertBefore(btn, cards[i]);
    else handArea.appendChild(btn);
  }
}

// ======================================================
// SCOUT 버튼 → 모드 ON
// ======================================================
scoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;
  if (tableCards.length === 0) return;

  scoutMode = true;
  renderTable();
};

// ======================================================
// 모달 처리 (먹통 해결)
// ======================================================
modalClose.onclick = () => {
  scoutModal.classList.add("hidden");
  scoutMode = false;
  renderTable();
};

modalKeep.onclick = () => {
  scoutFlip = false;
  scoutModal.classList.add("hidden");

  // insert 모드 실행
  renderInsertButtons();
};

modalReverse.onclick = () => {
  scoutFlip = true;
  scoutModal.classList.add("hidden");

  renderInsertButtons();
};

// ======================================================
// FLIP 방향 버튼
// ======================================================
flipToggleBtn.onclick = () => {
  flipReversed = !flipReversed;
  renderHand();
};

flipConfirmBtn.onclick = () => {
  flipSelect = false;
  flipSelectArea.classList.add("hidden");

  selected.clear();
  renderHand();
  renderTable();
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
  renderHand();
  renderTable();

  roundInfo.innerText = `라운드 ${round}`;
});

socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();

  renderHand();
  renderTable();
});

socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  insertMode = false;
  renderTable();
});

socket.on("turnChange", (uid) => {
  myTurn = uid === window.permUid;

  scoutMode = false;
  insertMode = false;

  renderTable();
});
