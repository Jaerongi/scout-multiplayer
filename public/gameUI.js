// ======================================================
//                 GAME UI FINAL VERSION v6
//     FIX: MOBILE FAN NOT SHOWING + ACTION BAR + LED
// ======================================================

import { drawScoutCard } from "./cardEngine.js";
import { socket } from "./socket.js";

let myHand = [];
let selected = new Set();
let pendingScoutCard = null;
let flipConfirmed = false;

const handArea = document.getElementById("handArea");
const tableArea = document.getElementById("tableArea");
const myCountSpan = document.getElementById("myCount");


// ======================================================
//        MOBILE DETECTION (CRITICAL FIX FOR iOS)
// ======================================================

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Samsung|LG|Mobile/i.test(navigator.userAgent);
}



// ======================================================
//                     RENDER HAND
// ======================================================

export function renderHand() {
  handArea.innerHTML = "";

  const count = myHand.length;
  myCountSpan.innerText = count;

  const isMobile = isMobileDevice();

  // 카드 수 → CSS 전달
  handArea.setAttribute("data-count", count);

  // ============== MOBILE FAN MODE ==============
  if (isMobile) {
    renderFanHand(count);
    return;
  }

  // ============== PC MODE ==============
  for (let i = 0; i <= count; i++) {
    if (pendingScoutCard) {
      if (i < count) {
        const card = myHand[i];
        const wrap = renderInsertSlot(card, i);
        handArea.appendChild(wrap);
        continue;
      }

      const last = document.createElement("div");
      last.style.display = "inline-block";
      last.style.position = "relative";
      last.style.width = "90px";
      last.style.height = "24px";

      const overlay = createInsertButton(i);
      last.appendChild(overlay);
      handArea.appendChild(last);
      break;
    }

    if (i === count) break;

    const card = myHand[i];
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";
    if (selected.has(i)) wrap.classList.add("selected");

    wrap.appendChild(drawScoutCard(card.top, card.bottom));

    wrap.onclick = () => {
      if (pendingScoutCard) return;
      if (!flipConfirmed) return alert("패 방향을 먼저 확정해주세요!");

      selected.has(i) ? selected.delete(i) : selected.add(i);
      renderHand();
    };

    handArea.appendChild(wrap);
  }
}



// ======================================================
//               FAN LAYOUT (MOBILE ONLY)
// ======================================================

function renderFanHand(count) {
  for (let i = 0; i < count; i++) {
    const card = myHand[i];
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";
    wrap.dataset.index = i;

    wrap.appendChild(drawScoutCard(card.top, card.bottom));

    // 카드 확대
    wrap.onclick = () => {
      document.querySelectorAll(".card-wrapper").forEach((el) =>
        el.classList.remove("active")
      );
      wrap.classList.add("active");
    };

    handArea.appendChild(wrap);
  }

  applyFanLayout(count);
}



// ======================================================
//       FAN POSITION CALCULATION (MOBILE FIXED)
// ======================================================

function applyFanLayout(count) {
  const cards = document.querySelectorAll(".card-wrapper");
  if (!cards.length) return;

  const maxAngle = 35;
  const step = count > 1 ? (maxAngle * 2) / (count - 1) : 0;

  cards.forEach((card, i) => {
    const angle = -maxAngle + step * i;
    const spread = (i - (count - 1) / 2) * 45;

    card.style.transform = `translateX(${spread}px) rotate(${angle}deg)`;
    card.style.left = "50%";
  });

  // 패가 화면 아래로 내려오지 않게 보정
  handArea.style.height = "240px";
  handArea.style.zIndex = "10";
}



// ======================================================
//           INSERT MODE HANDLER (+ 넣기)
// ======================================================

function createInsertButton(pos) {
  const overlay = document.createElement("div");
  overlay.className = "insert-overlay";
  overlay.innerText = "+ 넣기";

  overlay.onclick = () => {
    performScoutInsert(pendingScoutCard.isReverse, pos);
    pendingScoutCard = null;
  };

  return overlay;
}

function renderInsertSlot(card, index) {
  const wrap = document.createElement("div");
  wrap.style.display = "inline-block";
  wrap.style.position = "relative";

  const overlay = createInsertButton(index);
  wrap.appendChild(overlay);
  wrap.appendChild(drawScoutCard(card.top, card.bottom));

  return wrap;
}



// ======================================================
//                     TABLE RENDER
// ======================================================

export function renderTable(cards) {
  tableArea.innerHTML = "";

  cards.forEach((card) => {
    const canvas = drawScoutCard(card.top, card.bottom);

    canvas.onclick = () => {
      canvas.style.transform = "scale(1.2)";
      setTimeout(() => (canvas.style.transform = "scale(1)"), 250);
    };

    tableArea.appendChild(canvas);
  });
}



// ======================================================
//                    SOCKET EVENTS
// ======================================================

socket.on("yourHand", (hand) => {
  myHand = hand;
  renderHand();
});

socket.on("tableUpdate", (tableCards) => {
  renderTable(tableCards);
});



// ======================================================
//              SCOUT INSERT FROM SERVER
// ======================================================

export function enableScoutInsert(isReverse) {
  pendingScoutCard = { isReverse };
  renderHand();
}

export function disableScoutInsert() {
  pendingScoutCard = null;
  renderHand();
}



// ======================================================
//                  FLIP CONFIRMATION
// ======================================================

export function confirmFlip() {
  flipConfirmed = true;
  renderHand();
}
// MOBILE BUTTON MIRROR
document.getElementById("mShowBtn").onclick  = () => document.getElementById("showBtn").click();
document.getElementById("mScoutBtn").onclick = () => document.getElementById("scoutBtn").click();
document.getElementById("mShowScoutBtn").onclick = () => document.getElementById("showScoutBtn").click();

