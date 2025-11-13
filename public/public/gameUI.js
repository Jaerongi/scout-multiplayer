// ==========================================
// SCOUT – GAME PAGE LOGIC
// (싱글 소켓 + SPA 구조)
// ==========================================

import { socket, showPage, myUid, myName, roomId } from "./socket.js";
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

const showBtn   = document.getElementById("showBtn");
const scoutBtn  = document.getElementById("scoutBtn");
const passBtn   = document.getElementById("passBtn");

// =============================
// GAME STATE
// =============================
let players = {};           // 전체 플레이어 상태
let tableCards = [];        // 테이블 묶음
let myHand = [];            // 내 패(실제 배열)
let selected = new Set();   // 선택된 카드 index
let flipState = {};         // index: bottom/top
let myTurn = false;

// ==========================================
// PLAYER LIST UPDATE
// ==========================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
});

// ==========================================
// ROUND START
// ==========================================
socket.on("roundStart", ({ round, players: p, startingPlayer }) => {
  players = p;
  tableCards = [];
  roundInfo.innerText = `라운드 ${round}`;

  renderPlayerList();
  renderTable();

  myTurn = (startingPlayer === myUid);
  highlightTurn(startingPlayer);
});

// ==========================================
// 내 패 받음
// ==========================================
socket.on("yourHand", (handData) => {
  console.log("📥 YOUR HAND RECEIVED:", handData);

  myHand = handData;
  selected.clear();
  flipState = {};

  renderHand();
});

// ==========================================
// 손패 갱신
// ==========================================
socket.on("handCountUpdate", (counts) => {
  for (const uid in players) {
    players[uid].handCount = counts[uid];
  }
  renderPlayerList();
});

// ==========================================
// 테이블 갱신
// ==========================================
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

// ==========================================
// 턴 변경
// ==========================================
socket.on("turnChange", (uid) => {
  myTurn = (uid === myUid);
  highlightTurn(uid);
});

// ==========================================
// ERROR
// ==========================================
socket.on("errorMessage", (msg) => {
  alert(msg);
});

// ======================================================
// RENDERING – PLAYER LIST
// ======================================================
function renderPlayerList() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const box = document.createElement("div");
    box.className = "playerBox";

    if (p.uid === myUid) box.style.background = "#444";

    box.innerHTML = `
      <b>${p.nickname}</b><br>
      패: ${p.handCount}장<br>
      점수: ${p.score}
    `;

    gamePlayerList.appendChild(box);
  });
}

function highlightTurn(uid) {
  const boxes = gamePlayerList.children;
  const list = Object.values(players);

  for (let i = 0; i < list.length; i++) {
    if (list[i].uid === uid) boxes[i].classList.add("currentTurn");
    else boxes[i].classList.remove("currentTurn");
  }
}

// ======================================================
// RENDERING – TABLE
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
// RENDERING – HAND
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

    wrap.append(drawScoutCard(c.top, c.bottom));

    // flip 버튼
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
// ACTION BUTTONS
// ======================================================

// SHOW
showBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (selected.size === 0) return alert("카드를 선택하세요.");

  const selectedCards = [...selected].map(i => {
    const c = myHand[i];
    return flipState[i] === "bottom"
      ? { top: c.bottom, bottom: c.top }
      : c;
  });

  // 족보 체크
  if (getComboType(selectedCards) === "invalid")
    return alert("세트/런이 아닙니다.");

  if (!isStrongerCombo(selectedCards, tableCards))
    return alert("기존 테이블보다 약합니다.");

  socket.emit("show", { roomId, cards: selectedCards });

  selected.clear();
  flipState = {};
};

// SCOUT
scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (tableCards.length !== 1)
    return alert("스카우트는 테이블에 카드가 1장일 때만 가능합니다.");

  const t = tableCards[0];
  const pickBottom = confirm(`bottom(${t.bottom})을 가져갈까요?\n취소 = top(${t.top})`);

  const chosenValue = pickBottom ? "bottom" : "top";

  socket.emit("scout", { roomId, chosenValue });

  selected.clear();
};

// PASS
passBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  socket.emit("pass", { roomId });
};
