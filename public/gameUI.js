// =====================================================
// gameUI.js — 2025.11 FINAL GLOBAL VERSION
// =====================================================

// DOM
const tableBoard = document.getElementById("tableBoard");
const handBoard = document.getElementById("handBoard");
const flipArea = document.getElementById("flipArea");

const btnShow = document.getElementById("btnShow");
const btnScout = document.getElementById("btnScout");
const btnPass = document.getElementById("btnPass");

const flipLeftBtn = document.getElementById("flipLeftBtn");
const flipRightBtn = document.getElementById("flipRightBtn");
const confirmFlipBtn = document.getElementById("confirmFlipBtn");

const insertOverlay = document.getElementById("insertOverlay");
const insertSlots = document.getElementById("insertSlots");
const insertCancelBtn = document.getElementById("insertCancelBtn");

// 상태 변수
let selectedCards = [];
let scoutMode = false;
let scoutSide = null; // "left" 또는 "right"
let scoutFlip = false; // true면 뒤집기
let scoutCard = null; // 스카웃한 카드 임시 저장

// =====================================================
// 플레이어 목록 렌더 (게임 페이지용)
// =====================================================
window.renderPlayers = function () {
  // (roomUI가 방 페이지에서 렌더하지만, game 페이지에서도 필요 시 확장 가능)
};

// =====================================================
// 테이블 렌더
// =====================================================
window.renderTable = function () {
  tableBoard.innerHTML = "";

  const t = window.tableCards;
  if (!t || t.length === 0) return;

  t.forEach((c, i) => {
    const el = window.createTableCard(c, i, t.length);

    // 스카웃 좌/우 모드일 때 하이라이트
    if (scoutMode) {
      if (i === 0) el.classList.add("scout-target-left");
      if (i === t.length - 1) el.classList.add("scout-target-right");
    }

    // 클릭하면 스카웃 선택
    el.onclick = () => {
      if (!scoutMode) return;

      if (i === 0) {
        scoutSide = "left";
      } else if (i === t.length - 1) {
        scoutSide = "right";
      } else return;

      showScoutFlipPopup();
    };

    tableBoard.appendChild(el);
  });
};

// =====================================================
// 손패 렌더
// =====================================================
window.renderHand = function () {
  handBoard.innerHTML = "";

  const hand = window.myHand;
  if (!hand) return;

  // 삽입 슬롯 렌더링(B 방식)
  for (let i = 0; i <= hand.length; i++) {
    const slot = window.createInsertSlot(i);
    slot.onclick = () => {
      if (!scoutCard) return;

      socket.emit("scout", {
        roomId: window.roomId,
        permUid: window.permUid,
        side: scoutSide,
        flip: scoutFlip,
        pos: i
      });

      hideInsertOverlay();

      selectedCards = [];
      scoutMode = false;
      scoutCard = null;
      scoutSide = null;
      scoutFlip = false;
    };
    handBoard.appendChild(slot);

    if (i < hand.length) {
      const c = hand[i];
      const cardEl = window.drawHandCard(c);

      // 선택 시 테두리
      cardEl.onclick = () => {
        toggleSelectCard(i);
      };

      if (selectedCards.includes(i)) cardEl.classList.add("selected");

      handBoard.appendChild(cardEl);
    }
  }
};

// =====================================================
// 카드 선택/해제
// =====================================================
function toggleSelectCard(index) {
  if (selectedCards.includes(index)) {
    selectedCards = selectedCards.filter(i => i !== index);
  } else {
    selectedCards.push(index);
  }
  selectedCards.sort((a, b) => a - b);
  window.renderHand();
}

// =====================================================
// SHOW 버튼
// =====================================================
btnShow.onclick = () => {
  if (!window.myTurn) return;

  if (selectedCards.length === 0) {
    alert("카드를 선택하세요.");
    return;
  }

  const selected = selectedCards.map(i => window.myHand[i]);

  // 조합 가능 체크
  if (window.tableCards.length > 0) {
    const valid = window.isStrongerCombo(selected, window.tableCards);
    if (!valid) {
      alert("테이블보다 약합니다.");
      return;
    }
  }

  socket.emit("show", {
    roomId: window.roomId,
    permUid: window.permUid,
    cards: selected
  });

  selectedCards = [];
};

// =====================================================
// PASS 버튼
// =====================================================
btnPass.onclick = () => {
  if (!window.myTurn) return;

  socket.emit("scout", {
    roomId: window.roomId,
    permUid: window.permUid,
    side: null,
    flip: false,
    pos: null
  });
};

// =====================================================
// SCOUT 버튼
// =====================================================
btnScout.onclick = () => {
  if (!window.myTurn) return;
  if (!window.tableCards || window.tableCards.length === 0) {
    alert("스카웃할 카드가 없습니다.");
    return;
  }

  scoutMode = true;
  scoutSide = null;
  scoutFlip = false;
  scoutCard = null;

  renderTable();
};

// =====================================================
// SCOUT → flip 선택 UI 표시
// =====================================================
function showScoutFlipPopup() {
  flipArea.classList.remove("hidden");
}

// flip 방향 선택
flipLeftBtn.onclick = () => {
  scoutFlip = false;
};

flipRightBtn.onclick = () => {
  scoutFlip = true;
};

confirmFlipBtn.onclick = () => {
  flipArea.classList.add("hidden");
  showInsertOverlay();
};

// =====================================================
// 삽입 UI
// =====================================================
function showInsertOverlay() {
  insertOverlay.classList.remove("hidden");
}

function hideInsertOverlay() {
  insertOverlay.classList.add("hidden");
}

insertCancelBtn.onclick = hideInsertOverlay;

// =====================================================
// 턴 표시 하이라이트
// =====================================================
window.highlightTurn = function (uid) {
  console.log("현재 턴:", uid);
};

// =====================================================
// 턴 버튼 활성/비활성
// =====================================================
window.updateActionButtons = function () {
  const on = window.myTurn;

  btnShow.disabled = !on;
  btnScout.disabled = !on;
  btnPass.disabled = !on;

  if (on) {
    btnShow.classList.add("activeBtn");
    btnScout.classList.add("activeBtn");
    btnPass.classList.add("activeBtn");
  } else {
    btnShow.classList.remove("activeBtn");
    btnScout.classList.remove("activeBtn");
    btnPass.classList.remove("activeBtn");
  }
};

// 디버그
console.log("gameUI.js loaded (FINAL GLOBAL VERSION)");
