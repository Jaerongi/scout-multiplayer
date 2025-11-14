// ==========================================
// GAME PAGE LOGIC (SCOUT)
// ==========================================

// drawScoutCard 전역 함수 사용
const drawCard = window.drawScoutCard;

// DOM
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let flipState = {};
let myTurn = false;

// ================================
// 플레이어 목록 업데이트
// ================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

// ================================
// 라운드 시작
// ================================
socket.on("roundStart", ({ round, players: p, startingPlayer }) => {
  players = p;
  tableCards = [];
  roundInfo.innerText = `라운드 ${round}`;
  myTurn = startingPlayer === myUid;

  renderPlayers();
  renderTable();
});

// ================================
// 패 받기
// ================================
socket.on("yourHand", (handData) => {
  myHand = handData;
  selected.clear();
  flipState = {};
  renderHand();
});

// ================================
// 테이블 업데이트
// ================================
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

// ================================
// 턴 변경
// ================================
socket.on("turnChange", (uid) => {
  myTurn = uid === myUid;
  renderPlayers();
});

// ================================
// 렌더링 함수들
// ================================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox";

    if (p.uid === myUid) div.classList.add("me");
    if (p.uid === (myTurn ? myUid : null)) div.classList.add("currentTurn");

    div.innerHTML = `
      ${p.isHost ? "👑 " : ""}${p.nickname}
      <div style="font-size:12px; opacity:0.7;">
        패: ${p.handCount} / 점수: ${p.score}
      </div>
    `;

    gamePlayerList.append(div);
  });
}

function renderTable() {
  tableArea.innerHTML = "";
  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#aaa">(비어 있음)</span>`;
    return;
  }
  tableCards.forEach(c => tableArea.append(drawCard(c.top, c.bottom, 90, 130)));
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((card, idx) => {
    const isFlip = flipState[idx] === "bottom";
    const c = isFlip ? { top: card.bottom, bottom: card.top } : card;

    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";
    if (selected.has(idx)) wrap.classList.add("selected");

    wrap.append(drawCard(c.top, c.bottom));

    // flip button
    const flipBtn = document.createElement("div");
    flipBtn.className = "flip-btn";
    flipBtn.innerText = "↻";
    flipBtn.onclick = (e) => {
      e.stopPropagation();
      flipState[idx] = isFlip ? "top" : "bottom";
      renderHand();
    };
    wrap.append(flipBtn);

    // 카드 선택
    wrap.onclick = () => {
      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);
      renderHand();
    };

    handArea.append(wrap);
  });
}
