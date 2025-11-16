import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "./shared.js";

const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");

/* 🔥 추가됨: 전체 패 방향 전환 버튼 생성 */
let globalFlipBtn = null;

let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();   // 선택한 카드 index
let globalFlip = false;     // 전체 패가 뒤집힌 상태인지
let myTurn = false;

/* ===========================
   플레이어 리스트 업데이트
=========================== */
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

/* ===========================
   라운드 시작
=========================== */
socket.on("roundStart", ({ round, players: p, startingPlayer }) => {
  players = p;
  tableCards = [];
  roundInfo.innerText = `라운드 ${round}`;
  renderPlayers();
  renderTable();
});

/* ===========================
   내 패 받기
=========================== */
socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();

  /* 🔥 “전체 패 방향 전환 버튼”이 처음 로드되는 타이밍 */
  createGlobalFlipButton();

  renderHand();
});

/* ===========================
   테이블 업데이트
=========================== */
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

/* ===========================
   턴 변경
=========================== */
socket.on("turnChange", (uid) => {
  myTurn = (uid === myUid);
  highlightTurn(uid);
});

/* ===========================
   플레이어 목록 렌더링
=========================== */
function renderPlayers() {
  gamePlayerList.innerHTML = "";
  Object.values(players).forEach(p => {
    const row = document.createElement("div");
    row.className = "playerBox";
    if (p.uid === myUid) row.style.borderColor = "gold";

    row.innerHTML = `
      <b>${p.nickname}</b><br>
      패: ${p.handCount} | 점수: ${p.score}
    `;

    gamePlayerList.appendChild(row);
  });
}

function highlightTurn(uid) {
  const rows = document.querySelectorAll("#gamePlayerList .playerBox");
  const list = Object.values(players);

  rows.forEach((box, i) => {
    if (list[i].uid === uid) box.classList.add("currentTurn");
    else box.classList.remove("currentTurn");
  });
}

/* ===========================
   테이블 렌더링
=========================== */
function renderTable() {
  tableArea.innerHTML = "";
  if (tableCards.length === 0) {
    tableArea.innerHTML = "(비어있음)";
    return;
  }

  tableCards.forEach(c =>
    tableArea.append(drawScoutCard(c.top, c.bottom, 80, 110))
  );
}

/* ===========================
   🔥 전체 패 방향 전환 버튼 추가
=========================== */
function createGlobalFlipButton() {
  if (globalFlipBtn) return; // 중복 생성 방지

  globalFlipBtn = document.createElement("button");
  globalFlipBtn.innerText = "↻ 전체 방향 전환";
  globalFlipBtn.className = "btn-sub";
  globalFlipBtn.style.marginLeft = "10px";

  globalFlipBtn.onclick = () => {
    globalFlip = !globalFlip;
    renderHand();
  };

  /* “내 패(숫자)” 옆에 삽입 */
  document.getElementById("myCount").parentElement.append(globalFlipBtn);
}

/* ===========================
   패 렌더링
=========================== */
function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((card, idx) => {
    /* 🔥 개별 flip 제거 → 전체 flip 적용 */
    const realCard = globalFlip
      ? { top: card.bottom, bottom: card.top }
      : card;

    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    if (selected.has(idx)) wrap.classList.add("selected");

    wrap.append(drawScoutCard(realCard.top, realCard.bottom, 70, 100));

    /* 카드 선택 */
    wrap.onclick = () => {
      selected.has(idx) ? selected.delete(idx) : selected.add(idx);
      renderHand();
    };

    handArea.append(wrap);
  });
}

/* ===========================
   SHOW
=========================== */
showBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (selected.size === 0) return alert("카드를 선택하세요.");

  const cards = [...selected].map(i => {
    const c = myHand[i];
    return globalFlip
      ? { top: c.bottom, bottom: c.top }
      : { top: c.top, bottom: c.bottom };
  });

  if (getComboType(cards) === "invalid") return alert("세트/런이 아닙니다.");
  if (!isStrongerCombo(cards, tableCards)) return alert("기존 테이블보다 약합니다.");

  socket.emit("show", { roomId, cards });

  selected.clear();
};

/* ===========================
   SCOUT
=========================== */
scoutBtn.onclick = () => {
  if (!myTurn) return alert("턴 아님");

  if (tableCards.length !== 1)
    return alert("스카우트는 테이블에 1장일 때만 가능합니다.");

  const t = tableCards[0];
  const pickBottom = confirm(`bottom(${t.bottom}) / 취소 = top(${t.top})`);

  socket.emit("scout", {
    roomId,
    chosenValue: pickBottom ? "bottom" : "top"
  });

  selected.clear();
};
