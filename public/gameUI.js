// ===============================================
// GAME PAGE UI LOGIC (최종본)
// ===============================================

// socket.js 의 window.socket 사용
const socket = window.socket;

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "./shared.js";

// DOM 요소
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const flipAllBtn = document.getElementById("flipAllBtn");

// SHOW & SCOUT 버튼들
const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// 상태
let players = {};
let tableCards = [];
let myHand = [];
let flipState = {};     // index → "bottom" or undefined
let myTurn = false;
window.allHandsReady = false;  // socket.js 설정됨

// ===============================================
// 모든 패 방향 확정되면 SHOW/SCOUT 버튼 활성화
// ===============================================
window.enableActionsAfterHandConfirm = function() {
  showBtn.disabled = false;
  scoutBtn.disabled = false;
  showScoutBtn.disabled = false;
};

// ===============================================
// 플레이어 리스트 표시
// ===============================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
});

socket.on("handConfirmUpdate", (p) => {
  players = p;
  renderPlayerList();
});

function renderPlayerList() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach(p => {
    const div = document.createElement("div");
    div.className = "playerBox";

    if (p.uid === window.myUid) div.classList.add("myPlayer");
    if (p.uid === window.myUid && p.handConfirmed) div.classList.add("confirmed");

    div.innerHTML = `
      <b>${p.isHost ? "👑 " : ""}${p.nickname}</b>
      <div class="smallInfo">패: ${p.handCount} | 점수: ${p.score}</div>
      <div class="smallInfo">${p.handConfirmed ? "✔ 패 확정" : "⏳ 선택중"}</div>
    `;

    gamePlayerList.appendChild(div);
  });
}

// ===============================================
// 라운드 시작
// ===============================================
socket.on("roundStart", ({ round, players: p, startingPlayer }) => {
  players = p;
  tableCards = [];
  renderPlayerList();
  renderTable();

  myTurn = startingPlayer === window.myUid;
  highlightTurn(startingPlayer);
});

// ===============================================
// 턴 강조
// ===============================================
socket.on("turnChange", (uid) => {
  myTurn = uid === window.myUid;
  highlightTurn(uid);
});

function highlightTurn(uid) {
  const boxes = gamePlayerList.children;
  const list = Object.values(players);

  for (let i = 0; i < list.length; i++) {
    if (list[i].uid === uid) boxes[i].classList.add("currentTurn");
    else boxes[i].classList.remove("currentTurn");
  }
}

// ===============================================
// 내 패 수신
// ===============================================
socket.on("yourHand", (hand) => {
  myHand = hand;
  flipState = {};
  renderHand();
});

// ===============================================
// 핸드 렌더링
// ===============================================
function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((card, idx) => {
    const flipped = flipState[idx] === "bottom";
    const c = flipped ? { top: card.bottom, bottom: card.top } : card;

    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";
    wrap.append(drawScoutCard(c.top, c.bottom));

    handArea.append(wrap);
  });
}

// ===============================================
// 전체 패 뒤집기
// ===============================================
flipAllBtn.onclick = () => {
  Object.keys(myHand).forEach(i => {
    flipState[i] = flipState[i] === "bottom" ? "top" : "bottom";
  });
  renderHand();
};

// ===============================================
// 테이블 업데이트
// ===============================================
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#999">(비어 있음)</span>`;
    return;
  }

  tableCards.forEach(c => {
    tableArea.append(drawScoutCard(c.top, c.bottom, 90, 130));
  });
}

// ===============================================
// SHOW
// ===============================================
showBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (!window.allHandsReady) return alert("모바일 패 방향을 먼저 확정하세요.");

  alert("SHOW 기능은 다음 단계에서 카드 선택 기능 추가될 예정입니다.");
};

// ===============================================
// SCOUT
// ===============================================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (!window.allHandsReady) return alert("모든 플레이어의 패 방향이 확정되어야 합니다.");

  alert("SCOUT 기능도 다음 단계에서 테이블 양쪽 SCOUT 기능 완성될 예정입니다.");
};

// ===============================================
// SHOW & SCOUT
// ===============================================
showScoutBtn.onclick = () => {
  alert("SHOW & SCOUT 기능은 다음 단계에서 완성됩니다.");
};
