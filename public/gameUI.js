// ===============================
// GAME UI FINAL FIXED
// ===============================

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

// 상태 변수
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let flipConfirmed = false;
let flipCheckDone = false;

// 🔥 서버가 보내주는 턴 순서 그대로 사용
let turnOrder = [];
let myTurn = false;

// ===============================
// EVENT: PLAYER LIST UPDATE
// ===============================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

// ===============================
// EVENT: ROUND START
// ===============================
socket.on("roundStart", ({ round, players: p, startingPlayer, turnOrder: order }) => {
  players = p;
  tableCards = [];
  turnOrder = order;

  flipConfirmed = false;
  flipCheckDone = false;

  roundInfo.innerText = `라운드 ${round}`;

  renderPlayers();
  renderTable();
});

// ===============================
// 내 패 전달
// ===============================
socket.on("yourHand", (handData) => {
  myHand = handData;
  selected.clear();
  renderHand();
});

// ===============================
// 턴 변경 이벤트
// ===============================
socket.on("turnChange", (uid) => {
  myTurn = uid === myUid;

  if (myTurn && !flipConfirmed && !flipCheckDone) {
    alert("패 방향 확정 버튼을 눌러주세요!");
    flipCheckDone = true;
  }

  highlightTurn(uid);
});

// ===============================
// TABLE UPDATE
// ===============================
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

// ===============================
// RENDER — 플레이어 리스트
// ===============================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  // 🔥 서버가 준 turnOrder 순서로 렌더
  turnOrder.forEach(uid => {
    const p = players[uid];
    if (!p) return;

    const div = document.createElement("div");
    div.className = "playerBox small";
    div.setAttribute("data-uid", uid);

    div.innerHTML = `
      <b>${p.nickname}</b><br>
      패: ${p.hand.length}장<br>
      점수: ${p.score}
    `;

    gamePlayerList.appendChild(div);
  });
}

// ===============================
// 턴 강조 표시
// ===============================
function highlightTurn(uid) {
  const boxes = document.querySelectorAll("[data-uid]");

  boxes.forEach(b => {
    if (b.dataset.uid === uid) b.classList.add("turnGlow");
    else b.classList.remove("turnGlow");
  });
}

// ===============================
// RENDER — 테이블
// ===============================
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#888">(비어 있음)</span>`;
    return;
  }

  tableCards.forEach(c => {
    tableArea.append(drawScoutCard(c.top, c.bottom, 90, 130));
  });
}

// ===============================
// RENDER — 내 패
// ===============================
function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((c, idx) => {
    const div = document.createElement("div");
    div.className = "card-wrapper";

    if (selected.has(idx)) div.classList.add("selected");

    div.append(drawScoutCard(c.top, c.bottom));

    div.onclick = () => {
      if (!flipConfirmed) return alert("패 방향 확정 필요!");
      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);
      renderHand();
    };

    handArea.appendChild(div);
  });
}

// ===============================
// SHOW 실행
// ===============================
showBtn.onclick = () => {
  if (!myTurn) return alert("내 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향 확정 필요!");
  if (selected.size === 0) return alert("패를 선택하세요.");

  const selectedCards = [...selected].map(i => myHand[i]);

  if (getComboType(selectedCards) === "invalid")
    return alert("세트/런이 아닙니다.");

  if (!isStrongerCombo(selectedCards, tableCards))
    return alert("더 약한 패입니다.");

  socket.emit("show", {
    roomId,
    cards: selectedCards
  });

  selected.clear();
};

// ===============================
// SCOUT
// ===============================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("내 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향 확정 필요!");

  if (tableCards.length === 0) return alert("테이블이 비어 있습니다.");

  const pickLeft = confirm("왼쪽 카드 가져올까요?\n취소 = 오른쪽");
  const side = pickLeft ? "left" : "right";

  socket.emit("scout", { roomId, side });
};
