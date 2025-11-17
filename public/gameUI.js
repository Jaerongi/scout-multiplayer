// =======================================
// GAME UI — SCOUT 카드 삽입 + 카드 위 +버튼 오버레이 (최종 안정판)
// =======================================

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

// ============================
// 1단계 SCOUT 모달 DOM
// ============================
const scoutModal = document.getElementById("scoutModal");
const modalKeep = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose = document.getElementById("modalClose");

function openScoutModal() {
  scoutModal.classList.remove("hidden");
}
function closeScoutModal() {
  scoutModal.classList.add("hidden");
}

// ================================
// SCOUT 삽입 모드 상태 저장
// ================================
let pendingScoutCard = null;

// 현재 선택된 스카우트 방향 저장
let scoutSide = null;


// ================================
// SCOUT PREVIEW
// ================================
const scoutPreview = document.createElement("div");
scoutPreview.id = "scoutPreview";
scoutPreview.style.marginTop = "12px";
scoutPreview.style.textAlign = "center";
scoutPreview.style.display = "none";
handArea.parentElement.appendChild(scoutPreview);

function renderScoutPreview(card) {
  if (!card) {
    scoutPreview.style.display = "none";
    scoutPreview.innerHTML = "";
    return;
  }

  scoutPreview.style.display = "block";
  scoutPreview.innerHTML = `<div style="color:white; margin-bottom:6px;">가져올 카드 미리보기</div>`;
  scoutPreview.appendChild(drawScoutCard(card.top, card.bottom, 80, 120));
}

// 상태 변수
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let myTurn = false;
let flipConfirmed = false;

// 방향 버튼
const flipAllBtn = document.createElement("button");
flipAllBtn.innerText = "전체 방향 전환";
flipAllBtn.className = "btn-sub small";

const confirmFlipBtn = document.createElement("button");
confirmFlipBtn.innerText = "방향 확정";
confirmFlipBtn.className = "btn-green small";

document.querySelector("#myCount").parentElement.appendChild(flipAllBtn);
document.querySelector("#myCount").parentElement.appendChild(confirmFlipBtn);


// ========================================================
// SOCKET EVENTS
// ========================================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

socket.on("roundStart", ({ round, players: p }) => {
  players = p;
  tableCards = [];
  flipConfirmed = false;
  selected.clear();

  pendingScoutCard = null;

  flipAllBtn.style.display = "inline-block";
  confirmFlipBtn.style.display = "inline-block";

  roundInfo.innerText = `라운드 ${round}`;

  renderPlayers();
  renderTable();
  renderScoutPreview(null);
  updateActionButtons();
});

socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  pendingScoutCard = null;
  renderHand();
  renderScoutPreview(null);
  updateActionButtons();
});

socket.on("turnChange", (uid) => {
  myTurn = (uid === myUid);
  highlightTurn(uid);
  updateActionButtons();
});

socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
  updateActionButtons();
});


// ========================================================
// TABLE RENDER – 가져오기 버튼 생성
// ========================================================
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#888">(비어 있음)</span>`;
    return;
  }

  let highlightIndex = [];

  if (tableCards.length === 1) highlightIndex = [0];
  else if (tableCards.length === 2) highlightIndex = [0, 1];
  else highlightIndex = [0, tableCards.length - 1];

  tableCards.forEach((c, idx) => {
    const cardElem = drawScoutCard(c.top, c.bottom, 90, 130);
    const wrap = document.createElement("div");

    wrap.style.display = "inline-block";
    wrap.style.margin = "0 10px";
    wrap.style.textAlign = "center";

    wrap.appendChild(cardElem);

    if (highlightIndex.includes(idx)) {
      cardElem.classList.add("scout-highlight");

      const zone = document.createElement("div");
      zone.className = "scoutBtnZone";
      wrap.appendChild(zone);

      // 가져오기 버튼 생성
      const btn = document.createElement("button");
      btn.innerText = "가져오기";
      btn.className = "btn-green small scoutSelectBtn";

      btn.onclick = () => {
        if (!myTurn) return;
        if (!flipConfirmed) return alert("패 방향을 먼저 확정해주세요!");

        scoutSide = idx === 0 ? "left" : "right";

        // 가져올 카드 미리보기
        renderScoutPreview(c);

        openScoutModal();
      };

      zone.appendChild(btn);
    }

    tableArea.appendChild(wrap);
  });
}


// ========================================================
// 1단계 모달 → 삽입 모드로 전환
// ========================================================
modalKeep.onclick = () => {
  pendingScoutCard = { side: scoutSide, isReverse: false };
  closeScoutModal();
  renderHand(); // 삽입버튼 표시
};

modalReverse.onclick = () => {
  pendingScoutCard = { side: scoutSide, isReverse: true };
  closeScoutModal();
  renderHand();
};

modalClose.onclick = closeScoutModal;


// ========================================================
// HAND (삽입버튼 카드 위 오버레이 버전)
// ========================================================
function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  // ⭐ NEW: 카드 수 → CSS 전달
  handArea.setAttribute("data-count", myHand.length);

  const inserting = pendingScoutCard !== null;

  for (let i = 0; i <= myHand.length; i++) {

    if (inserting) {
      if (i < myHand.length) {
        const card = myHand[i];
        const wrap = document.createElement("div");
        wrap.style.display = "inline-block";
        wrap.style.position = "relative";

        const overlay = document.createElement("div");
        overlay.className = "insert-overlay";
        overlay.innerText = "+ 넣기";

        overlay.onclick = () => {
          performScoutInsert(pendingScoutCard.isReverse, i);
          pendingScoutCard = null;
        };

        wrap.appendChild(overlay);
        wrap.appendChild(drawScoutCard(card.top, card.bottom));
        handArea.appendChild(wrap);

        continue;
      }

      const lastSlot = document.createElement("div");
      lastSlot.style.display = "inline-block";
      lastSlot.style.position = "relative";
      lastSlot.style.width = "90px";
      lastSlot.style.height = "24px";

      const overlay = document.createElement("div");
      overlay.className = "insert-overlay";
      overlay.innerText = "+ 넣기";
      overlay.onclick = () => {
        performScoutInsert(pendingScoutCard.isReverse, i);
        pendingScoutCard = null;
      };

      lastSlot.appendChild(overlay);
      handArea.appendChild(lastSlot);
      break;
    }

    if (i === myHand.length) break;

    const card = myHand[i];
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    if (selected.has(i)) wrap.classList.add("selected");

    wrap.appendChild(drawScoutCard(card.top, card.bottom));

    wrap.onclick = () => {
      if (pendingScoutCard) return;
      if (!flipConfirmed) return alert("패 방향을 먼저 확정해주세요!");

      if (selected.has(i)) selected.delete(i);
      else selected.add(i);

      renderHand();
    };

    handArea.appendChild(wrap);
  }

  // ⭐ 인디케이터 업데이트
  updateHandIndicator();
}


// ========================================================
// PLAYER LIST
// ========================================================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox";
    div.innerHTML = `<b>${p.nickname}</b><br>패: ${p.hand.length}장<br>점수: ${p.score}`;
    gamePlayerList.appendChild(div);
  });
}

function highlightTurn(uid) {
  const boxes = gamePlayerList.children;
  const arr = Object.values(players);

  for (let i = 0; i < arr.length; i++) {
    const box = boxes[i];
    if (arr[i].uid === uid) box.classList.add("turnGlow");
    else box.classList.remove("turnGlow");
  }
}


// ========================================================
// FLIP
// ========================================================
flipAllBtn.onclick = () => {
  if (flipConfirmed) return;
  myHand = myHand.map(c => ({ top: c.bottom, bottom: c.top }));
  renderHand();
};

confirmFlipBtn.onclick = () => {
  flipConfirmed = true;

  flipAllBtn.style.display = "none";
  confirmFlipBtn.style.display = "none";

  socket.emit("confirmFlip", {
    roomId,
    flipped: myHand
  });

  updateActionButtons();
};


// ========================================================
// SHOW
// ========================================================
showBtn.onclick = () => {
  if (!myTurn) return alert("내 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향을 확정해주세요.");
  if (selected.size === 0) return alert("카드를 선택하세요.");

  const cards = [...selected].map(i => myHand[i]);

  if (getComboType(cards) === "invalid")
    return alert("세트 또는 런이 아닙니다.");

  if (!isStrongerCombo(cards, tableCards))
    return alert("기존 테이블보다 약합니다.");

  socket.emit("show", { roomId, cards });
  selected.clear();
  renderScoutPreview(null);
};


// ========================================================
// SCOUT 버튼 (UI용)
// ========================================================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향을 먼저 확정해주세요.");
  if (tableCards.length === 0) return alert("테이블이 비어있습니다.");
};


// ========================================================
// 실제 삽입 기능
// ========================================================
function performScoutInsert(isReverse, pos) {
  socket.emit("scout", {
    roomId,
    side: pendingScoutCard.side,
    flip: isReverse,
    pos: pos
  });
}


// ========================================================
// 버튼 활성화 관리
// ========================================================
function updateActionButtons() {
  const isActive = myTurn;

  showBtn.disabled = !isActive;
  scoutBtn.disabled = !isActive;
  showScoutBtn.disabled = !isActive;

  showBtn.style.opacity = isActive ? "1" : "0.4";
  scoutBtn.style.opacity = isActive ? "1" : "0.4";
  showScoutBtn.style.opacity = isActive ? "1" : "0.4";

  document.querySelectorAll(".scoutSelectBtn").forEach(btn => {
    btn.disabled = !isActive;
    btn.style.opacity = isActive ? "1" : "0.4";
  });
}

// ==========================
//   HAND PAGE INDICATOR ●
// ==========================
const handIndicator = document.createElement("div");
handIndicator.id = "handIndicator";
handArea.parentElement.appendChild(handIndicator);

function updateHandIndicator() {
  const count = myHand.length;
  const dots = [];

  for (let i = 0; i < count; i++) {
    dots.push(`<span class="${i === 0 ? "active" : ""}">●</span>`);
  }

  handIndicator.innerHTML = dots.join(" ");
}
