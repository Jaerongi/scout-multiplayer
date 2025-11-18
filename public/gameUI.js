// ======================================================
// GAME UI — 최종 완성본
// (가져오기 버튼 위치 복원 + 턴 변경 시 버튼 자동 제거)
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

// Flip selection
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

// SCOUT 관련
let scoutTargetSide = null;
let scoutFlip = false;

// ======================================================
// 플레이어 리스트 렌더
// ======================================================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach(p => {
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
// HAND 렌더링
// ======================================================
function getDisplayedHand() {
  return flipReversed
    ? myHand.map(c => ({ top: c.bottom, bottom: c.top }))
    : myHand;
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  const disp = getDisplayedHand();

  disp.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    if (selected.has(i)) wrap.classList.add("selected");

    wrap.onclick = () => {
      if (flipSelect) return alert("패 방향을 먼저 확정하세요!");
      if (selected.has(i)) selected.delete(i);
      else selected.add(i);
      renderHand();
    };

    wrap.appendChild(drawScoutCard(c.top, c.bottom));
    handArea.appendChild(wrap);
  });
}

// ======================================================
// TABLE 렌더링 — 가져오기 버튼 완전 복원 + 턴 변경 시 자동 제거
// ======================================================
function renderTable() {
  tableArea.innerHTML = "";

  const count = tableCards.length;

  if (count === 0) {
    tableArea.innerHTML = `<span style='color:#555'>(비어 있음)</span>`;
    return;
  }

  tableCards.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.style.textAlign = "center";

    // 카드 이미지 붙이기
    wrap.appendChild(drawScoutCard(c.top, c.bottom));

    const isEdgeLeft = idx === 0;
    const isEdgeRight = idx === count - 1;

    // 턴이 아니면 dim 처리하고 버튼 없음
    if (!myTurn || flipSelect) {
      wrap.style.filter = "brightness(1)";
      tableArea.appendChild(wrap);
      return;
    }

    // 가져올 수 있는 곳 판정
    let canTake = false;
    let side = null;

    if (count === 1) {
      canTake = true;
      side = "left";
    } else if (count === 2) {
      canTake = true;
      side = idx === 0 ? "left" : "right";
    } else if (count >= 3) {
      if (isEdgeLeft) {
        canTake = true;
        side = "left";
      } else if (isEdgeRight) {
        canTake = true;
        side = "right";
      }
    }

    // 하이라이트
    wrap.style.filter = canTake ? "brightness(1)" : "brightness(0.35)";

    // 가져오기 버튼
    if (canTake) {
      const btn = document.createElement("button");
      btn.innerText = "가져오기";
      btn.className = "btn-orange small";
      btn.style.marginTop = "6px";

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
// 패 사이에 + 버튼 (SCOUT 삽입 위치)
// ======================================================
function renderInsertButtons() {
  document.querySelectorAll(".insert-btn").forEach(el => el.remove());

  const cards = handArea.children;

  for (let i = 0; i <= cards.length; i++) {
    const btn = document.createElement("button");
    btn.innerText = "+";
    btn.className = "insert-btn";
    btn.style.margin = "6px";
    btn.style.padding = "4px 8px";
    btn.style.background = "#333";
    btn.style.border = "1px solid #ffd76e";
    btn.style.color = "#ffd76e";
    btn.style.borderRadius = "6px";
    btn.style.cursor = "pointer";

    btn.onclick = () => {
      socket.emit("scout", {
        roomId,
        permUid: window.permUid,
        side: scoutTargetSide,
        flip: scoutFlip,
        pos: i
      });

      document.querySelectorAll(".insert-btn").forEach(el => el.remove());
    };

    if (i < cards.length) handArea.insertBefore(btn, cards[i]);
    else handArea.appendChild(btn);
  }
}

// ======================================================
// 턴 표시
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
// action 버튼 활성화
// ======================================================
function updateActionButtons() {
  const active = myTurn && !flipSelect;

  [showBtn, scoutBtn, showScoutBtn].forEach(btn => {
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
  const chosen = Array.from(selected).map(i => disp[i]);

  if (chosen.length === 0) return alert("카드를 선택하세요.");

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen
  });
};

// ======================================================
// SCOUT
// ======================================================
scoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;
  if (tableCards.length === 0) return;

  scoutModal.classList.remove("hidden");
};

modalClose.onclick = () => scoutModal.classList.add("hidden");
modalKeep.onclick = () => {
  scoutFlip = false;
  scoutModal.classList.add("hidden");
  renderInsertButtons();
};
modalReverse.onclick = () => {
  scoutFlip = true;
  scoutModal.classList.add("hidden");
  renderInsertButtons();
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
  highlightTurn(uid);
  updateActionButtons();
  renderTable();   // ★ 턴 변경 시 가져오기 버튼 즉시 제거
});
