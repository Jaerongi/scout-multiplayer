// =====================================================
// cardEngine.js — GLOBAL DRAW FUNCTIONS (전역 버전)
// =====================================================

const G = (typeof window !== "undefined") ? window : global;

// =====================================================
// 카드 DOM 요소 생성
// =====================================================
// c = { top: n, bottom: n }
// highlight = true / false
// rotate = true: 90도 회전 (선택용)
// =====================================================
G.createCardElement = function (c, options = {}) {
  const { highlight = false, selectable = false } = options;

  const el = document.createElement("div");
  el.className = "card";

  if (highlight) el.classList.add("highlight");
  if (selectable) el.classList.add("selectable");

  el.innerHTML = `
    <div class="card-top">${c.top}</div>
    <div class="card-bottom">${c.bottom}</div>
  `;

  return el;
};


// =====================================================
// SCOUT 테이블 하이라이트 카드 (좌/우 선택)
// =====================================================
G.createTableCard = function (c, index, totalLen) {
  const el = document.createElement("div");
  el.className = "table-card";

  // 좌측/우측 scout 가능 위치 표시
  if (index === 0) el.classList.add("scout-left");
  if (index === totalLen - 1) el.classList.add("scout-right");

  el.innerHTML = `
    <div class="card-top">${c.top}</div>
    <div class="card-bottom">${c.bottom}</div>
  `;

  return el;
};


// =====================================================
// 손패 한 장 카드
// =====================================================
G.drawHandCard = function (c) {
  const el = document.createElement("div");
  el.className = "hand-card";

  el.innerHTML = `
    <div class="card-top">${c.top}</div>
    <div class="card-bottom">${c.bottom}</div>
  `;

  return el;
};


// =====================================================
// "+" 삽입 슬롯 (SCOUT B 방식)
// =====================================================
G.createInsertSlot = function (index) {
  const slot = document.createElement("div");
  slot.className = "insert-slot";
  slot.dataset.pos = index;
  slot.innerText = "+";
  return slot;
};


// =====================================================
// 디버그용
// =====================================================
console.log("cardEngine.js loaded (GLOBAL VERSION)");
