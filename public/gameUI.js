// ======================================================
// GAME UI — SCOUT 방향 선택 / SHOW / SCOUT / TURN UI
// (삽입 모달 제거 + +넣기 버튼 + 라운드 승자 + 최종 우승)
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

// responsive sizing
function applyHandSizing(cardCount) {
  // Keep the whole hand visible in one screen width by scaling card size + overlap.
  const host = handArea;
  // Use viewport width as the source of truth to avoid layout-dependent jumps
  // (e.g. flipSelect area showing/hiding).
  const w = Math.max(1, Math.min(window.innerWidth, host.clientWidth || window.innerWidth) - 28);
  const n = Math.max(1, cardCount);

  // overlap ratio (how much a new card covers the previous one)
  const overlap = 0.62; // 0..1 (higher -> more overlap)
  const shiftFactor = 1 - overlap;
  const rawCardW = w / (1 + (n - 1) * shiftFactor);

  // Clamp to a reasonable range (slightly smaller on phones)
  const maxW = window.innerWidth <= 420 ? 108 : 128;
  const cardW = Math.max(52, Math.min(maxW, Math.floor(rawCardW)));
  const cardH = Math.floor(cardW * 1.45);
  const overlapPx = Math.floor(cardW * overlap);

  host.style.setProperty('--card-w', `${cardW}px`);
  host.style.setProperty('--card-h', `${cardH}px`);
  host.style.setProperty('--overlap-px', `${overlapPx}px`);
}

function applyTableSizing(cardCount) {
  // Make table cards scale to the table area so they look consistent.
  const host = tableArea;
  const w = Math.max(1, Math.min(window.innerWidth, host.clientWidth || window.innerWidth) - 24);
  const n = Math.max(1, cardCount);

  // Cards on table should be a bit larger than hand when there's room.
  const wrapCols = Math.min(n, window.innerWidth <= 420 ? 4 : 6);
  const rawCardW = w / Math.max(1, wrapCols);

  const maxW = window.innerWidth <= 420 ? 112 : 138;
  const cardW = Math.max(56, Math.min(maxW, Math.floor(rawCardW)));
  const cardH = Math.floor(cardW * 1.45);

  host.style.setProperty('--card-w', `${cardW}px`);
  host.style.setProperty('--card-h', `${cardH}px`);
}

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
// 현재 보이는 패(뒤집힌 상태 반영)
// ======================================================
function getDisplayedHand() {
  return flipReversed
    ? myHand.map((c) => ({ top: c.bottom, bottom: c.top }))
    : myHand;
}

// ======================================================
// 선택 조합 유효성 검사 (RUN or SET 맞는지)
// ======================================================
function isValidSelection(disp, indices) {
  if (indices.length <= 1) return true;

  const cards = indices.map((i) => disp[i]);
  const nums = cards.map((c) => c.top).sort((a, b) => a - b);

  const allSame = nums.every((n) => n === nums[0]);
  if (allSame) return true;

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) return false;
  }

  return true;
}

// ======================================================
// 내 패 렌더링 (+넣기 버튼 적용)
// ======================================================
function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  const disp = getDisplayedHand();

  // Always keep the hand on one screen if possible
  applyHandSizing(disp.length);

  // Always use overlap layout so the hand stays fixed without horizontal scrolling
  handArea.classList.toggle('fan', true);

  // Render cards first (buttons will be overlaid so they don't affect layout width)
  disp.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    // Fan rotation only in normal play (not in insert mode)
    if (!insertMode) {
      const n = Math.max(1, disp.length);
      const maxAngle = 18; // deg
      const angle = n === 1 ? 0 : (-maxAngle + (2 * maxAngle * i) / (n - 1));
      const lift = -Math.abs(angle) * 0.35; // px; edges slightly lower
      wrap.style.setProperty("--rot", `${angle}deg`);
      wrap.style.setProperty("--lift", `${lift}px`);
      wrap.style.zIndex = String(i + 1);
    } else {
      wrap.style.zIndex = String(i + 1);
    }

    if (!insertMode) {
      if (selected.has(i)) wrap.classList.add("selected");

      wrap.onclick = () => {
        if (flipSelect) return alert("패 방향을 먼저 확정하세요!");

        const newSet = new Set(selected);

        if (newSet.has(i)) newSet.delete(i);
        else newSet.add(i);

        const idxArr = Array.from(newSet);
        if (!isValidSelection(disp, idxArr)) return;

        selected = newSet;
        renderHand();
      };
    }

    wrap.appendChild(drawScoutCard(c.top, c.bottom));
    handArea.appendChild(wrap);
  });

  // Insert overlay buttons (SCOUT mode)
  // Make the buttons float on top of the hand so the hand doesn't expand and cause scrollbars.
  const ensureInsertOverlay = () => {
    let overlay = handArea.querySelector(".insert-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "insert-overlay";
      handArea.appendChild(overlay);
    }
    overlay.innerHTML = "";
    return overlay;
  };

  const createInsertButton = (pos, leftPx) => {
    const btn = document.createElement("button");
    btn.className = "insert-btn-overlay";
    btn.type = "button";
    btn.innerText = "+";
    btn.style.left = `${leftPx}px`;

    btn.onclick = (e) => {
      e.stopPropagation();
      insertMode = false;

      socket.emit("scout", {
        roomId,
        permUid: window.permUid,
        side: insertCardInfo.side,
        flip: insertCardInfo.flip,
        pos,
      });

      // UI will re-render from server state; render once immediately for responsiveness.
      renderHand();
    };

    return btn;
  };

  if (insertMode) {
    const overlay = ensureInsertOverlay();

    // Create buttons first; we'll measure real card positions and then place them.
    // pos 0..n (n = disp.length)
    for (let pos = 0; pos <= disp.length; pos++) {
      overlay.appendChild(createInsertButton(pos, 0));
    }

    // After layout, position each + button centered in the gap between cards.
    // This avoids scrollbars and prevents all buttons from bunching to the left.
    requestAnimationFrame(() => {
      const wraps = Array.from(handArea.querySelectorAll('.card-wrapper'));
      const btns  = Array.from(overlay.querySelectorAll('.insert-btn-overlay'));
      if (wraps.length === 0 || btns.length === 0) return;

      const handRect = handArea.getBoundingClientRect();
      const rects = wraps.map(w => w.getBoundingClientRect());

      btns.forEach((btn, pos) => {
        // left is the CENTER x because the button uses translateX(-50%)
        let x;
        if (pos === 0) {
          x = rects[0].left - handRect.left;
        } else if (pos === rects.length) {
          x = rects[rects.length - 1].right - handRect.left;
        } else {
          x = (rects[pos - 1].right + rects[pos].left) / 2 - handRect.left;
        }

        // Clamp so it never goes out of the hand container.
        const bw = btn.getBoundingClientRect().width || 32;
        const min = bw * 0.6;
        const max = handRect.width - bw * 0.6;
        x = Math.max(min, Math.min(max, x));

        btn.style.left = `${x}px`;
      });
    });
  }
}

// Re-apply sizing on resize
window.addEventListener('resize', () => {
  try {
    applyHandSizing(getDisplayedHand().length);
    applyTableSizing(tableCards.length);
  } catch {}
});

// ======================================================
// 테이블 렌더링
// ======================================================
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#777">(비어 있음)</span>`;
    return;
  }

  applyTableSizing(tableCards.length);

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
// 선택된 카드 -> 현재 방향(top/bottom) 그대로 서버 전달
// ======================================================
function getChosenCards() {
  const disp = getDisplayedHand();
  return Array.from(selected).map(i => ({
    top: disp[i].top,
    bottom: disp[i].bottom,
  }));
}

// ======================================================
// SHOW
// ======================================================
showBtn.onclick = () => {
  if (!myTurn || flipSelect) return;

  const chosen = getChosenCards();
  if (chosen.length === 0) return alert("카드를 선택하세요!");

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen,
  });

  // Optimistic UI: clear selection
  selected.clear();
  renderHand();
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

// SHOW & SCOUT (helper): if cards selected -> SHOW, else -> enter SCOUT mode
showScoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;
  if (tableCards.length === 0) return alert("테이블이 비어있어요!");

  const chosen = getChosenCards();
  if (chosen.length > 0) {
    socket.emit("show", {
      roomId,
      permUid: window.permUid,
      cards: chosen,
    });
    selected.clear();
    renderHand();
    return;
  }

  scoutMode = true;
  renderTable();
};

// ======================================================
// SCOUT 모달
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

socket.on("actionError", (msg) => {
  alert(msg || "동작을 수행할 수 없어요.");
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
