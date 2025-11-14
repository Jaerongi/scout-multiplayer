// ==========================================
// SCOUT – GAME PAGE LOGIC (최종 안정 버전)
// ==========================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "./shared.js";

// =============================
// DOM
// =============================
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// =============================
// GAME STATE
// =============================
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let flipState = {};
let myTurn = false;

// ==========================================
// PLAYER LIST 업데이트
// ==========================================
window.socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
});

// ==========================================
// ROUND START
// ==========================================
window.socket.on("roundStart", ({ round, players: p, startingPlayer }) => {
  players = p;
  tableCards = [];
  roundInfo.innerText = `라운드 ${round}`;

  renderPlayerList();
  renderTable();

  myTurn = startingPlayer === window.myUid;
  highlightTurn(startingPlayer);
});

// ==========================================
// 내 패 수신
// ==========================================
window.socket.on("yourHand", (handData) => {
  myHand = handData;
  selected.clear();
  flipState = {};
  renderHand();
});

// ==========================================
// 손패 갱신
// ==========================================
window.socket.on("handCountUpdate", (counts) => {
  for (const uid in players) {
    players[uid].handCount = counts[uid];
  }
  renderPlayerList();
});

// ==========================================
// 테이블 갱신
// ==========================================
window.socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

// ==========================================
// 턴 변경
// ==========================================
window.socket.on("turnChange", (uid) => {
  myTurn = uid === window.myUid;
  highlightTurn(uid);
});

// ==========================================
// ERROR
// ==========================================
window.socket.on("errorMessage", (msg) => {
  alert(msg);
});

// ======================================================
// RENDER – PLAYER LIST
// ======================================================
function renderPlayerList() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const box = document.createElement("div");
    box.className = "playerBox";

    if (p.uid === window.myUid) box.classList.add("meBox");

    box.innerHTML = `
      ${p.isHost ? "👑 " : ""}${p.nickname}
      <br>
      패: ${p.handCount} &nbsp; 점수: ${p.score}
    `;

    box.dataset.uid = p.uid;
    gamePlayerList.appendChild(box);
  });
}

function highlightTurn(uid) {
  [...gamePlayerList.children].forEach((box) => {
    if (box.dataset.uid === uid) box.classList.add("currentTurn");
    else box.classList.remove("currentTurn");
  });
}

// ======================================================
// RENDER – TABLE
// ======================================================
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#888">(비어 있음)</span>`;
    return;
  }

  tableCards.forEach((c) => {
    tableArea.append(drawScoutCard(c.top, c.bottom, 90, 130));
  });
}

// ======================================================
// RENDER – HAND
// ======================================================
function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((card, idx) => {
    const flipped = flipState[idx] === "bottom";
    const c = flipped
      ? { top: card.bottom, bottom: card.top }
      : card;

    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";
    if (selected.has(idx)) wrap.classList.add("selected");

    wrap.append(drawScoutCard(c.top, c.bottom, 85, 120));

    const flipBtn = document.createElement("div");
    flipBtn.className = "flip-btn";
    flipBtn.innerText = "↻";
    flipBtn.onclick = (e) => {
      e.stopPropagation();
      flipState[idx] = flipped ? "top" : "bottom";
      renderHand();
    };
    wrap.append(flipBtn);

    wrap.onclick = () => {
      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);
      renderHand();
    };

    handArea.append(wrap);
  });
}

// ======================================================
// ACTIONS – SHOW
// ======================================================
showBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (selected.size === 0) return alert("카드를 선택하세요.");

  const selectedCards = [...selected].map(i => {
    const c = myHand[i];
    return flipState[i] === "bottom"
      ? { top: c.bottom, bottom: c.top }
      : c;
  });

  if (getComboType(selectedCards) === "invalid")
    return alert("세트/런이 아닙니다.");

  if (!isStrongerCombo(selectedCards, tableCards))
    return alert("기존 테이블보다 약합니다.");

  window.socket.emit("show", { roomId: window.roomId, cards: selectedCards });

  selected.clear();
  flipState = {};
};

// ======================================================
// ACTIONS – SCOUT
// ======================================================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (tableCards.length !== 1)
    return alert("SCOUT은 테이블에 카드 1장일 때만 가능합니다.");

  const t = tableCards[0];
  const pickBottom = confirm(`bottom(${t.bottom}) 가져올까요?\n취소 = top(${t.top})`);

  const chosenValue = pickBottom ? "bottom" : "top";

  window.socket.emit("scout", { roomId: window.roomId, chosenValue });
};

// ======================================================
// ACTIONS – SHOW & SCOUT
// ======================================================
showScoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (tableCards.length !== 1)
    return alert("SHOW & SCOUT은 테이블이 1장일 때만 가능");

  if (selected.size === 0)
    return alert("합칠 카드를 선택하세요.");

  const t = tableCards[0];
  const pickBottom = confirm(`bottom(${t.bottom}) 가져올까요?\n취소 = top(${t.top})`);

  const extraCard = pickBottom
    ? { top: t.bottom, bottom: t.top }
    : { top: t.top, bottom: t.bottom };

  const selectedCards = [...selected].map(i => {
    const c = myHand[i];
    return flipState[i] === "bottom"
      ? { top: c.bottom, bottom: c.top }
      : c;
  });

  selectedCards.push(extraCard);

  if (getComboType(selectedCards) === "invalid")
    return alert("세트/런이 아닙니다.");

  if (!isStrongerCombo(selectedCards, tableCards))
    return alert("기존 테이블보다 약합니다.");

  window.socket.emit("showScout", {
    roomId: window.roomId,
    cards: selectedCards,
    extraCard,
  });

  selected.clear();
  flipState = {};
};
