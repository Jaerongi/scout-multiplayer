// =======================================
// GAME UI — SCOUT 2단계 모달 + 위치 선택 (최종 안정본)
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

// ============================
// 2단계 INSERT 모달 DOM
// ============================
const insertModal = document.getElementById("insertModal");
const insertModalContent = document.getElementById("insertModalContent");

function openInsertModal(isReverse) {
  insertModal.classList.remove("hidden");
  insertModalContent.innerHTML = `<p style="margin-bottom:12px;">어디에 넣을까요?</p>`;

  // 내 패 위치에 따라 버튼 생성
  for (let i = 0; i <= myHand.length; i++) {
    let label = "";

    if (i === 0) label = "(맨 앞)";
    else if (i === myHand.length) label = "(맨 뒤)";
    else {
      const c = myHand[i];
      label = `${c.top}/${c.bottom} 앞`;
    }

    const btn = document.createElement("button");
    btn.innerText = "넣기 " + label;
    btn.className = "btn-green small";

    btn.onclick = () => {
      performScoutInsert(isReverse, i);
      closeInsertModal();
    };

    insertModalContent.appendChild(btn);
  }

  // 취소 버튼
  const cancelBtn = document.createElement("button");
  cancelBtn.innerText = "취소";
  cancelBtn.className = "btn-sub small";
  cancelBtn.onclick = closeInsertModal;
  insertModalContent.appendChild(cancelBtn);
}

function closeInsertModal() {
  insertModal.classList.add("hidden");
}

// 선택한 위치로 SCOUT 실행
function performScoutInsert(isReverse, pos) {
  socket.emit("scout", {
    roomId,
    side: scoutSide,
    flip: isReverse,
    pos: pos
  });

  scoutSide = null;
}

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

      // ★ 가져오기 버튼 (기본 생성)
      const btn = document.createElement("button");
      btn.innerText = "가져오기";
      btn.className = "btn-green small scoutSelectBtn";

      btn.onclick = () => {
        if (!myTurn) return;
        if (!flipConfirmed) return alert("패 방향을 먼저 확정해주세요!");

        scoutSide = idx === 0 ? "left" : "right";
        openScoutModal();
      };

      zone.appendChild(btn);
    }

    tableArea.appendChild(wrap);
  });
}

// ========================================================
// HAND
// ========================================================
function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((card, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    if (selected.has(idx)) wrap.classList.add("selected");

    wrap.appendChild(drawScoutCard(card.top, card.bottom));

    wrap.onclick = () => {
      if (!flipConfirmed) return alert("패 방향 확정 후 선택 가능합니다!");

      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);

      renderHand();
    };

    handArea.appendChild(wrap);
  });
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
// 1단계 모달에서 선택 후 → 2단계 모달 열기
// ========================================================
modalKeep.onclick = () => {
  openInsertModal(false);
  closeScoutModal();
};

modalReverse.onclick = () => {
  openInsertModal(true);
  closeScoutModal();
};

modalClose.onclick = closeScoutModal;

// ========================================================
// ACTION BUTTON CONTROL (가져오기 버튼 포함)
// ========================================================
function updateActionButtons() {
  const isActive = myTurn;

  showBtn.disabled = !isActive;
  scoutBtn.disabled = !isActive;
  showScoutBtn.disabled = !isActive;

  showBtn.style.opacity = isActive ? "1" : "0.4";
  scoutBtn.style.opacity = isActive ? "1" : "0.4";
  showScoutBtn.style.opacity = isActive ? "1" : "0.4";

  // 가져오기 버튼도 동일 조건 적용
  document.querySelectorAll(".scoutSelectBtn").forEach(btn => {
    btn.disabled = !isActive;
    btn.style.opacity = isActive ? "1" : "0.4";
  });
}
