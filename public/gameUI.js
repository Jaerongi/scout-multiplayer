// ==========================================
// SCOUT – GAME PAGE LOGIC
// window.socket / window.myUid 구조 대응 버전
// ==========================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "./shared.js";

// DOM
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const passBtn = document.getElementById("passBtn");

// 상태
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let flipState = {};
let myTurn = false;

// ================================
// 플레이어 목록 업데이트
// ================================
window.socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
});

// ================================
// 라운드 시작
// ================================
window.socket.on("roundStart", ({ round, players: p, startingPlayer }) => {
  players = p;
  tableCards = [];
  myTurn = (startingPlayer === window.myUid);

  roundInfo.innerText = `라운드 ${round}`;
  renderPlayerList();
  renderTable();
  highlightTurn(startingPlayer);
});

// ================================
// 내 패 수신
// ================================
window.socket.on("yourHand", (handData) => {
  console.log("📥 YOUR HAND:", handData);

  myHand = handData;
  selected.clear();
  flipState = {};

  renderHand();
});

// ================================
// 손패 갱신
// ================================
window.socket.on("handCountUpdate", (counts) => {
  for (const uid in players) {
    players[uid].handCount = counts[uid];
  }
  renderPlayerList();
});

// ================================
// 테이블 갱신
// ================================
window.socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

// ================================
// 턴 변경
// ================================
window.socket.on("turnChange", (uid) => {
  myTurn = (uid === window.myUid);
  highlightTurn(uid);
});

// ================================
// UI 렌더링
// ================================
function renderPlayerList() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const box = document.createElement("div");
    box.className = "playerBox";

    if (p.uid === window.myUid)
      box.style.background = "#333";

    box.innerHTML = `
      <b>${p.nickname}</b><br>
      패: ${p.handCount}장<br>
      점수: ${p.score}
    `;

    gamePlayerList.append(box);
  });
}

function highlightTurn(uid) {
  const boxes = gamePlayerList.children;
  const list = Object.values(players);

  for (let i = 0; i < list.length; i++) {
    if (list[i].uid === uid)
      boxes[i].classList.add("currentTurn");
    else
      boxes[i].classList.remove("currentTurn");
  }
}

function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#999">(비어 있음)</span>`;
    return;
  }

  tableCards.forEach((c) => {
    tableArea.append(drawScoutCard(c.top, c.bottom, 90, 130));
  });
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((card, idx) => {
    const flipped = (flipState[idx] === "bottom");
    const c = flipped
      ? { top: card.bottom, bottom: card.top }
      : card;

    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";
    if (selected.has(idx)) wrap.classList.add("selected");

    wrap.append(drawScoutCard(c.top, c.bottom));

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

// ================================
// SHOW / SCOUT / PASS
// ================================
showBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (selected.size === 0) return alert("카드를 선택하세요.");

  const selectedCards = [...selected].map(i => {
    const c = myHand[i];
    return flipState[i] === "bottom"
      ? { top: c.bottom, bottom: c.top }
      : { top: c.top, bottom: c.bottom };
  });

  if (getComboType(selectedCards) === "invalid")
    return alert("세트/런이 아닙니다.");

  if (!isStrongerCombo(selectedCards, tableCards))
    return alert("기존 테이블보다 약합니다.");

  window.socket.emit("show", { roomId: window.roomId, cards: selectedCards });

  selected.clear();
  flipState = {};
};

scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (tableCards.length !== 1)
    return alert("스카우트는 테이블에 1장일 때만 가능합니다.");

  const t = tableCards[0];
  const chooseBottom = confirm(`bottom(${t.bottom})을 가져옵니까?\n취소 = top(${t.top})`);
  const chosenValue = chooseBottom ? "bottom" : "top";

  window.socket.emit("scout", { roomId: window.roomId, chosenValue });
};

passBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  window.socket.emit("pass", { roomId: window.roomId });
};
