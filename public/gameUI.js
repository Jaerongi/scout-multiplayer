// ================================
// SCOUT – GAME PAGE LOGIC (최종본)
// ================================

// 🔥 socket 가져오기 (가장 중요)
import { socket, myUid, roomId } from "./socket.js";

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "./shared.js";

// ================================
// DOM 요소
// ================================
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

const confirmHandBtn = document.getElementById("confirmHandBtn");

// ================================
// LOCAL GAME STATE
// ================================
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let flipState = {};
let myTurn = false;

// 초기 핸드 방향 확정 여부
let initialHandConfirmed = false;

// ===============================================
// 플레이어 목록 표시
// ===============================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
});

// ===============================================
// 라운드 시작
// ===============================================
socket.on("roundStart", ({ round, players: p, startingPlayer }) => {
  players = p;
  tableCards = [];

  roundInfo.innerText = `라운드 ${round}`;

  renderPlayerList();
  renderTable();

  myTurn = (startingPlayer === myUid);
  highlightTurn(startingPlayer);
});

// ===============================================
// “내 손패” 수신
// ===============================================
socket.on("yourHand", (handData) => {
  console.log("📥 Hand Received:", handData);

  myHand = handData;
  selected.clear();
  flipState = {};

  // 초기 모드 시작
  initialHandConfirmed = false;
  confirmHandBtn.style.display = "block";

  renderHand();
});

// ===============================================
// 손패 개수 갱신
// ===============================================
socket.on("handCountUpdate", (counts) => {
  for (const uid in players) {
    players[uid].handCount = counts[uid];
  }
  renderPlayerList();
});

// ===============================================
// 테이블 정보 갱신
// ===============================================
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

// ===============================================
// 턴 변경
// ===============================================
socket.on("turnChange", (uid) => {
  myTurn = uid === myUid;
  highlightTurn(uid);
});

// ===============================================
// 에러 메시지
// ===============================================
socket.on("errorMessage", (msg) => alert(msg));

// ===============================================
// 플레이어 리스트 렌더링
// ===============================================
function renderPlayerList() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const box = document.createElement("div");
    box.className = "playerBox";

    if (p.uid === myUid) {
      box.classList.add("myPlayer");
    }

    box.innerHTML = `
      <b>${p.isHost ? "👑 " : ""}${p.nickname}</b>
      <div class="smallInfo">패: ${p.handCount} | 점수: ${p.score}</div>
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
    const card = drawScoutCard(c.top, c.bottom, 90, 130);
    tableArea.append(card);
  });
}

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

    // 초기 설정 모드일 때는 flip 가능
    if (!initialHandConfirmed) {
      wrap.onclick = () => {
        flipState[idx] = flipped ? "top" : "bottom";
        renderHand();
      };
    }

    handArea.append(wrap);
  });
}

// ===============================================
// 패 방향 확정 버튼
// ===============================================
confirmHandBtn.onclick = () => {
  initialHandConfirmed = true;
  confirmHandBtn.style.display = "none";

  renderHand(); // flip 비활성화 반영

  socket.emit("handConfirmed", {
    roomId,
    flipState
  });

  alert("패 방향이 확정되었습니다!");
};

// ===============================================
// SHOW
// ===============================================
showBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (selected.size === 0) return alert("카드를 선택하세요.");

  const selectedCards = [...selected].map((i) => {
    const c = myHand[i];
    return flipState[i] === "bottom"
      ? { top: c.bottom, bottom: c.top }
      : c;
  });

  if (getComboType(selectedCards) === "invalid")
    return alert("유효한 세트/런이 아닙니다.");

  if (!isStrongerCombo(selectedCards, tableCards))
    return alert("기존 테이블보다 약합니다.");

  socket.emit("show", { roomId, cards: selectedCards });

  selected.clear();
  flipState = {};
};

// ===============================================
// SCOUT
// ===============================================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (tableCards.length !== 1)
    return alert("스카우트는 테이블에 카드가 1장일 때만 가능합니다.");

  const t = tableCards[0];
  const pickBottom = confirm(`BOTTOM(${t.bottom})을 가져갈까요?\n취소 = TOP(${t.top})`);
  const chosenValue = pickBottom ? "bottom" : "top";

  socket.emit("scout", { roomId, chosenValue });

  selected.clear();
};

// ===============================================
// SHOW & SCOUT (추후 구현)
// ===============================================
showScoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  alert("Show & Scout 기능은 다음 단계에서 구현됩니다!");
};
