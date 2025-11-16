// ==========================================
// SCOUT – GAME PAGE LOGIC (최종 완성본)
// ==========================================
import { drawScoutCard } from "./cardEngine.js";
// GLOBAL from socket.js
// window.socket
// window.myUid
// window.roomId

// DOM ELEMENTS
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const roundInfo = document.getElementById("roundInfo");
const myCountSpan = document.getElementById("myCount");

// ACTION BUTTONS
const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn"); // 사용 예정

// GAME STATE
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let flipState = {};
let myTurn = false;


// ======================================================
// 플레이어 리스트 렌더링
// ======================================================
function renderGamePlayers(players) {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const box = document.createElement("div");
    box.className = "playerBox";

    // 현재 턴이면 하이라이트
    if (p.uid === window.currentTurnUid) {
      box.classList.add("currentTurn");
    }

    // 방장 아이콘 포함
    const crown = p.isHost ? "👑 " : "";

    box.innerHTML = `
      <div><b>${crown}${p.nickname} 정보 : 패: ${p.handCount} & 점수: ${p.score}</b></div>
    `;

    gamePlayerList.appendChild(box);
  });
}


// ======================================================
// 테이블 렌더링
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
// 손패 렌더링
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
// SHOW
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

  socket.emit("show", { roomId, cards: selectedCards });

  selected.clear();
  flipState = {};
};


// ======================================================
// SCOUT
// ======================================================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");

  if (tableCards.length !== 1)
    return alert("스카우트는 테이블에 1장일 때만 가능합니다.");

  const t = tableCards[0];
  const pickBottom = confirm(`bottom(${t.bottom})을 가져갈까요?\n취소 = top(${t.top})`);

  const chosenValue = pickBottom ? "bottom" : "top";
  socket.emit("scout", { roomId, chosenValue });

  selected.clear();
};



// ======================================================
// SOCKET EVENTS
// ======================================================

// 플레이어 정보 받음
socket.on("playerListUpdate", (p) => {
  players = p;
  renderGamePlayers(p);
});

// 내 패 받음
socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  flipState = {};
  renderHand();
});

// 테이블 갱신
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

// 턴 변화
socket.on("turnChange", (uid) => {
  myTurn = (uid === window.myUid);
  window.currentTurnUid = uid;
  renderGamePlayers(players);
});

// 라운드 시작
socket.on("roundStart", ({ round, players: p, startingPlayer }) => {
  players = p;
  tableCards = [];
  roundInfo.innerText = `라운드 ${round}`;

  window.currentTurnUid = startingPlayer;
  renderGamePlayers(players);
  renderTable();
});

// 첫 패 받을 때 실행
socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  flipState = {};

  // 🔥 최초 1회만 방향 선택
  if (!window.initialHandChosen) {
    window.initialHandChosen = true;

    const ask = confirm("카드를 반대로 시작하시겠습니까?\n\n확인 = 반대로\n취소 = 그대로");

    if (ask) {
      myHand = myHand.map(c => ({ top: c.bottom, bottom: c.top }));
    }
  }

  renderHand();
});







