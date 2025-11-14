// ===============================================
// SCOUT – GAME PAGE LOGIC (window.socket 기반 버전)
// ===============================================

// -------------------------------
// 🔥 전역 socket.js 사용
// -------------------------------
const socket = window.socket;

function getMyUid() { return window.myUid; }
function getRoomId() { return window.roomId; }

// -------------------------------
// IMPORT
// -------------------------------
import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "./shared.js";

// -------------------------------
// DOM 요소
// -------------------------------
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
let flipState = {};
let selected = new Set();
let myTurn = false;

// -------------------------------
// 플레이어 리스트 갱신
// -------------------------------
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
});

// -------------------------------
// 라운드 시작
// -------------------------------
socket.on("roundStart", ({ round, players: p, startingPlayer }) => {
  players = p;
  tableCards = [];

  roundInfo.innerText = `라운드 ${round}`;
  renderPlayerList();
  renderTable();

  myTurn = (startingPlayer === getMyUid());
  highlightTurn(startingPlayer);
});

// -------------------------------
// 내 패 수신
// -------------------------------
socket.on("yourHand", (cards) => {
  console.log("📥 내 패:", cards);

  myHand = cards;
  flipState = {};
  selected.clear();

  renderHand();
});

// -------------------------------
// 테이블 업데이트
// -------------------------------
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

// -------------------------------
// 손패 개수 갱신
// -------------------------------
socket.on("handCountUpdate", (counts) => {
  for (const uid in players) {
    players[uid].handCount = counts[uid];
  }
  renderPlayerList();
});

// -------------------------------
// 턴 변경
// -------------------------------
socket.on("turnChange", (uid) => {
  myTurn = uid === getMyUid();
  highlightTurn(uid);
});

// -------------------------------
// 에러 표시
// -------------------------------
socket.on("errorMessage", (msg) => alert(msg));

// ===============================================
// 플레이어 리스트 렌더링
// ===============================================
function renderPlayerList() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const box = document.createElement("div");
    box.className = "playerBox";

    if (p.uid === getMyUid()) box.classList.add("myPlayer");
    if (p.uid === players[p.uid].uid && p.isHost) {
      box.innerHTML = `<b>👑 ${p.nickname}</b><br>패: ${p.handCount} | 점수: ${p.score}`;
    } else {
      box.innerHTML = `<b>${p.nickname}</b><br>패: ${p.handCount} | 점수: ${p.score}`;
    }

    gamePlayerList.appendChild(box);
  });
}

// 턴 강조
function highlightTurn(uid) {
  const list = Object.values(players);
  const boxes = gamePlayerList.children;

  for (let i = 0; i < list.length; i++) {
    if (list[i].uid === uid) boxes[i].classList.add("currentTurn");
    else boxes[i].classList.remove("currentTurn");
  }
}

// ===============================================
// 테이블 렌더링
// ===============================================
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

// ===============================================
// 핸드 렌더링
// ===============================================
function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((card, idx) => {
    const flip = flipState[idx] === "bottom";

    const c = flip
      ? { top: card.bottom, bottom: card.top }
      : { top: card.top, bottom: card.bottom };

    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    wrap.append(drawScoutCard(c.top, c.bottom));

    handArea.append(wrap);
  });
}

// ===============================================
// SHOW 기능
// ===============================================
showBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (selected.size === 0) return alert("카드를 선택하세요.");

  const picked = [...selected].map((i) => {
    const c = myHand[i];
    return flipState[i] === "bottom"
      ? { top: c.bottom, bottom: c.top }
      : { top: c.top, bottom: c.bottom };
  });

  if (getComboType(picked) === "invalid")
    return alert("세트/런이 아닙니다.");

  if (!isStrongerCombo(picked, tableCards))
    return alert("기존 테이블보다 약합니다.");

  socket.emit("show", { roomId: getRoomId(), cards: picked });

  selected.clear();
  flipState = {};
};

// ===============================================
// SCOUT (기본 1장 버전 — 이후 확장가능)
// ===============================================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (tableCards.length !== 1)
    return alert("테이블에 1장일 때만 가능합니다.");

  const t = tableCards[0];
  const ask = confirm(`BOTTOM(${t.bottom}) 가져갈까요?\n취소 = TOP(${t.top})`);
  const chosen = ask ? "bottom" : "top";

  socket.emit("scout", {
    roomId: getRoomId(),
    chosenValue: chosen
  });

  selected.clear();
};

// ===============================================
// SHOW & SCOUT (다음 단계 확장)
// ===============================================
showScoutBtn.onclick = () => {
  alert("Show & Scout 기능은 다음 단계에서 완성됩니다!");
};
