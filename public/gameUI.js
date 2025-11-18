// ======================================================
// GAME UI — SCOUT 전체 기능 완성본
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

// Flip select
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

let scoutMode = false;         // SCOUT 가능 상태
let scoutTargetSide = null;    // left or right
let scoutFlip = false;         // 그대로 / 반대로 가져오기

// ======================================================
// 플레이어 리스트
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
      점수: ${p.score}<br>
      ${p.isOnline ? "" : "<span style='color:#aaa;'>오프라인</span>"}
    `;

    gamePlayerList.appendChild(div);
  });
}

// ======================================================
// 핸드 렌더링 (+넣기 버튼 포함)
// ======================================================
function getDisplayedHand() {
  if (!flipReversed) return myHand;
  return myHand.map((c) => ({ top: c.bottom, bottom: c.top }));
}

function createInsertButton(pos) {
  const btn = document.createElement("button");
  btn.className = "insert-btn";
  btn.innerText = "+넣기";

  btn.onclick = () => {
    socket.emit("scout", {
      roomId,
      permUid: window.permUid,
      side: scoutTargetSide,
      flip: scoutFlip,
      pos: pos,
    });

    scoutMode = false;
    renderTable();
    renderHand();
  };

  const wrap = document.createElement("div");
  wrap.className = "insert-wrapper";
  wrap.appendChild(btn);

  return wrap;
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  const disp = getDisplayedHand();

  // 첫 번째 앞에 insert 버튼
  if (scoutMode && !flipSelect) {
    handArea.appendChild(createInsertButton(0));
  }

  disp.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    // SHOW 모드일 때만 카드 눌러 선택 가능
    if (!scoutMode) {
      if (selected.has(i)) wrap.classList.add("selected");

      wrap.onclick = () => {
        if (flipSelect) return alert("패 방향을 먼저 확정하세요!");
        if (selected.has(i)) selected.delete(i);
        else selected.add(i);
        renderHand();
      };
    }

    wrap.appendChild(drawScoutCard(c.top, c.bottom));
    handArea.appendChild(wrap);

    // 카드 뒤에 insert 버튼
    if (scoutMode && !flipSelect) {
      handArea.appendChild(createInsertButton(i + 1));
    }
  });
}

// ======================================================
// 테이블 렌더링 (3장 이상일 때 양 끝만 SCOUT 가능)
// ======================================================
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#555">(비어 있음)</span>`;
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
        (tableCards.length === 2 && (idx === 0 || idx === 1)) ||
        (tableCards.length >= 3 && (idx === 0 || idx === tableCards.length - 1))
      );

    if (canScout) {
      wrap.classList.add("scout-glow");

      const btn = document.createElement("button");
      btn.className = "take-btn";
      btn.innerText = "가져오기";

      btn.onclick = () => {
        if (tableCards.length === 1) {
          scoutTargetSide = "left";
        } else if (idx === 0) {
          scoutTargetSide = "left";
        } else {
          scoutTargetSide = "right";
        }
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
  if (chosen.length === 0) return alert("카드를 선택하세요.");

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen,
  });
};

// ======================================================
// SCOUT
// ======================================================
scoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;
  if (tableCards.length === 0) return;

  scoutMode = true;
  renderTable();
};

// SCOUT 모달
modalClose.onclick = () => scoutModal.classList.add("hidden");

modalKeep.onclick = () => {
  scoutFlip = false;
  scoutModal.classList.add("hidden");
  renderHand();
};

modalReverse.onclick = () => {
  scoutFlip = true;
  scoutModal.classList.add("hidden");
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
  renderHand();
  updateActionButtons();
});

socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
  updateActionButtons();
});

socket.on("turnChange", (uid) => {
  myTurn = uid === window.permUid;

  scoutMode = false;
  highlightTurn(uid);
  renderTable();
  renderHand();
  updateActionButtons();
});
