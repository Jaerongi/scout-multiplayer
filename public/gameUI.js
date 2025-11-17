// =======================================
// GAME UI — SCOUT MODAL VERSION
// =======================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// ---------------------------
// MODAL DOM
// ---------------------------
const modal = document.getElementById("scoutModal");
const modalNormal = document.getElementById("modal-normal");
const modalReverse = document.getElementById("modal-reverse");
const modalClose = document.getElementById("modal-close");

// 현재 선택된 side 저장 ("left" or "right")
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

let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let myTurn = false;
let flipConfirmed = false;

// ---------------------------
// 방향 버튼
// ---------------------------
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
});

socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  renderHand();
  renderScoutPreview(null);
});

socket.on("turnChange", (uid) => {
  myTurn = (uid === myUid);
  highlightTurn(uid);
});

socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});


// ========================================================
// TABLE RENDER — 카드 아래 버튼은 1개만 ("가져오기")
// ========================================================
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#ccc">(비어 있음)</span>`;
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

      // 가져오기 버튼 1개만
      const btn = document.createElement("button");
      btn.innerText = "가져오기";
      btn.className = "btn-green small scoutSelectBtn";
      btn.onclick = () => {
        scoutSide = idx === 0 ? "left" : "right";
        openScoutModal();
      };

      zone.appendChild(btn);
    }

    tableArea.appendChild(wrap);
  });
}


// ========================================================
// HAND RENDER
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
  Object.values(players).forEach(p => {
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
    if (arr[i].uid === uid) boxes[i].classList.add("turnGlow");
    else boxes[i].classList.remove("turnGlow");
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
// SCOUT 버튼 → 기존 버튼 전부 삭제 후 "가져오기"만 남김
// ========================================================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향을 먼저 확정해주세요.");
  if (tableCards.length === 0) return alert("테이블이 비어있습니다.");

  document.querySelectorAll(".scoutSelectBtn").forEach(b => b.remove());

  // renderTable()에서 이미 "가져오기" 버튼 생성되므로 따로 처리 필요 없음
};


// ========================================================
// SHOW+SCOUT (미구현)
// ========================================================
showScoutBtn.onclick = () => {
  alert("아직 준비되지 않은 기능입니다!");
};


// ========================================================
// SCOUT MODAL LOGIC
// ========================================================
function openScoutModal() {
  modal.classList.remove("hidden");
}

function closeScoutModal() {
  modal.classList.add("hidden");
}

modalClose.onclick = closeScoutModal;

modalNormal.onclick = () => {
  performScout(false);
};

modalReverse.onclick = () => {
  performScout(true);
};


// ========================================================
// 실제 SCOUT 실행
// ========================================================
function performScout(isReverse) {
  if (!scoutSide) return closeScoutModal();

  socket.emit("scout", {
    roomId,
    side: scoutSide,
    flip: isReverse,
    pos: myHand.length
  });

  closeScoutModal();
  scoutSide = null;
}
