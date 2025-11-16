// =============================
// GAME UI
// =============================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "./shared.js";

const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");

// flip UI
let flipConfirmed = false;

const flipAllBtn = document.createElement("button");
flipAllBtn.textContent = "전체 flip";
flipAllBtn.className = "btn-sub small";

const confirmFlipBtn = document.createElement("button");
confirmFlipBtn.textContent = "확정";
confirmFlipBtn.className = "btn-green small";

document
  .getElementById("roundInfo")
  .appendChild(flipAllBtn);

document
  .getElementById("roundInfo")
  .appendChild(confirmFlipBtn);

// ------------------------------
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();

let myTurn = false;

// ------------------------------
socket.on("goGamePage", () => {
  showPage("gamePage");
});

socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

socket.on("roundStart", ({ players: p, startingPlayer }) => {
  players = p;
  tableCards = [];
  flipConfirmed = false;
  renderPlayers();
  renderTable();
});

socket.on("yourHand", (h) => {
  myHand = h;
  selected.clear();
  renderHand();
});

socket.on("tableUpdate", (t) => {
  tableCards = t;
  renderTable();
});

socket.on("turnChange", (uid) => {
  myTurn = uid === myUid;

  highlightTurn(uid);
});

// ------------------------------
// RENDER
// ------------------------------
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox";

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
    if (list[i].uid === uid) {
      boxes[i].classList.add("turnGlow");
    } else {
      boxes[i].classList.remove("turnGlow");
    }
  }
}

function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#888"> (비어 있음) </span>`;
    return;
  }

  tableCards.forEach((c) => {
    tableArea.append(drawScoutCard(c.top, c.bottom, 90, 130));
  });
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.textContent = myHand.length;

  myHand.forEach((card, idx) => {
    const div = document.createElement("div");
    div.className = "card-wrapper";

    if (selected.has(idx)) div.classList.add("selected");

    div.append(drawScoutCard(card.top, card.bottom));

    div.onclick = () => {
      if (!flipConfirmed) return alert("패 방향 확정 필요!");
      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);
      renderHand();
    };

    handArea.append(div);
  });
}

// ------------------------------
// FLIP
// ------------------------------
flipAllBtn.onclick = () => {
  if (flipConfirmed) return;

  myHand = myHand.map((c) => ({
    top: c.bottom,
    bottom: c.top
  }));

  renderHand();
};

confirmFlipBtn.onclick = () => {
  flipConfirmed = true;
  confirmFlipBtn.style.display = "none";

  socket.emit("confirmFlip", {
    roomId,
    flipped: myHand
  });
};

// ------------------------------
// SHOW
// ------------------------------
showBtn.onclick = () => {
  if (!myTurn) return alert("내 턴 아님");
  if (!flipConfirmed) return alert("패 방향 확정 필요");
  if (selected.size === 0) return alert("카드를 선택하세요");

  const sel = [...selected].map((i) => myHand[i]);

  if (getComboType(sel) === "invalid") return alert("세트/런 아님");
  if (!isStrongerCombo(sel, tableCards))
    return alert("기존 테이블보다 약함");

  socket.emit("show", { roomId, cards: sel });
  selected.clear();
};

// ------------------------------
// SCOUT
// ------------------------------
scoutBtn.onclick = () => {
  if (!myTurn) return alert("내 턴 아님");

  if (tableCards.length === 0) return alert("테이블이 비어있음");

  const left = confirm("왼쪽 패를 가져올까요? (취소=오른쪽)");

  socket.emit("scout", {
    roomId,
    side: left ? "left" : "right"
  });
};
