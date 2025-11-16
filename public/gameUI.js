// ===============================
// GAME UI FINAL
// ===============================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "./shared.js";

const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// flip 관련 UI
let flipMode = false;
const flipAllBtn = document.createElement("button");
flipAllBtn.innerText = "전체 방향 전환";
flipAllBtn.className = "btn-sub small";

const confirmFlipBtn = document.createElement("button");
confirmFlipBtn.innerText = "방향 확정";
confirmFlipBtn.className = "btn-green small";

document.querySelector(".section-title").appendChild(flipAllBtn);
document.querySelector(".section-title").appendChild(confirmFlipBtn);

// ===============================
// 상태 변수
// ===============================
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let flipState = {};
let myTurn = false;
let flipConfirmed = false;
let flipCheckDone = false;

// ===============================
// LIST UPDATE
// ===============================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

// ===============================
// ROUND START
// ===============================
socket.on("roundStart", ({ round, players: p, startingPlayer }) => {
  players = p;
  tableCards = [];

  flipConfirmed = false;
  flipCheckDone = false;

  roundInfo.innerText = `라운드 ${round}`;

  renderPlayers();
  renderTable();
});

// ===============================
// 내 패 받기
// ===============================
socket.on("yourHand", (handData) => {
  myHand = handData;
  selected.clear();
  flipState = {};
  renderHand();
});

// ===============================
// TURN CHANGE
// ===============================
socket.on("turnChange", (uid) => {
  myTurn = uid === myUid;

  // 플립 확정 전에는 내 턴일 때 알림을 한번만 띄우고
  if (myTurn && !flipConfirmed) {
    alert("패 방향을 확정해주세요!");
  }

  highlightTurn(uid);
});


// ===============================
// 테이블 / 패 / 플레이어 출력 함수
// ===============================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox small";

    if (p.uid === myUid) div.style.border = "2px solid #ffd700";

    div.innerHTML = `
      <b>${p.nickname}</b><br>
      패: ${p.hand.length}장<br>
      점수: ${p.score}
    `;

    gamePlayerList.appendChild(div);
  });
}

function highlightTurn(uid) {
  const boxes = gamePlayerList.children;
  const list = Object.values(players);

  for (let i = 0; i < list.length; i++) {
    if (list[i].uid === uid) boxes[i].classList.add("turnGlow");
    else boxes[i].classList.remove("turnGlow");
  }
}

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

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((card, idx) => {
    const flipped = flipState[idx] === "bottom";
    const c = flipped ? { top: card.bottom, bottom: card.top } : card;

    const div = document.createElement("div");
    div.className = "card-wrapper";

    if (selected.has(idx)) div.classList.add("selected");

    div.append(drawScoutCard(c.top, c.bottom));

    div.onclick = () => {
      if (!flipConfirmed) return; // flip 확정 전 선택 금지
      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);
      renderHand();
    };

    handArea.appendChild(div);
  });
}

// ===============================
// 전체 flip 기능
// ===============================
flipAllBtn.onclick = () => {
  if (flipConfirmed) return;

  myHand = myHand.map((c) => ({
    top: c.bottom,
    bottom: c.top
  }));

  renderHand();
};

// 확정 버튼
confirmFlipBtn.onclick = () => {
  flipConfirmed = true;
  confirmFlipBtn.style.display = "none";

  socket.emit("confirmFlip", {
    roomId,
    flippedOrder: myHand
  });
};

// ===============================
// SHOW
// ===============================
showBtn.onclick = () => {
  if (!myTurn) return alert("내 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향 확정 버튼을 누르세요!");
  if (selected.size === 0) return alert("카드를 선택하세요.");

  const selectedCards = [...selected].map(i => myHand[i]);

  if (getComboType(selectedCards) === "invalid")
    return alert("세트/런이 아닙니다.");

  if (!isStrongerCombo(selectedCards, tableCards))
    return alert("기존 테이블보다 약합니다.");

  socket.emit("show", { roomId, cards: selectedCards });
  selected.clear();
};

// ===============================
// SCOUT (좌/우 선택)
// ===============================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("내 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향 확정 버튼을 누르세요!");

  if (tableCards.length === 0)
    return alert("테이블이 비어 있습니다.");

  const pickLeft = confirm("왼쪽 카드 가져올까요?\n취소 = 오른쪽");

  const side = pickLeft ? "left" : "right";

  socket.emit("scout", { roomId, side });
};

// ===============================
// SHOW & SCOUT — ★ (나중에 추가 가능)
// ===============================
showScoutBtn.onclick = () => {
  alert("추가 개발 예정!");
};

