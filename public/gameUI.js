// ======================================================
// GAME UI — 완전 안정버전 (READY LED 정상, FLIP 정상, SCOUT 완전 정상)
// ======================================================

// ⚠️ 페이지 가드: 게임 페이지가 아닐 경우 gameUI 실행하지 않음
if (!document.getElementById("gamePage")) {
  console.log("gameUI.js 비활성화 — 게임 페이지가 아님");
  export {};
}

// ======================================================
// IMPORT
// ======================================================
import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// ======================================================
// DOM ELEMENTS
// ======================================================
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea      = document.getElementById("tableArea");
const handArea       = document.getElementById("handArea");
const myCountSpan    = document.getElementById("myCount");
const roundInfo      = document.getElementById("roundInfo");

const showBtn     = document.getElementById("showBtn");
const scoutBtn    = document.getElementById("scoutBtn");

const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn  = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

const scoutModal   = document.getElementById("scoutModal");
const modalKeep    = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose   = document.getElementById("modalClose");

// ======================================================
// STATE (roomUI와 충돌 방지 위해 players → gamePlayers)
// ======================================================
let gamePlayers    = {};
let tableCards     = [];
let myHand         = [];
let selected       = new Set();

let myTurn         = false;
let flipSelect     = true;
let flipReversed   = false;

let scoutMode       = false;
let scoutTargetSide = null;
let scoutFlip       = false;

// ======================================================
// PLAYER LIST
// ======================================================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  Object.values(gamePlayers).forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox";
    if (!p.isOnline) div.classList.add("offlinePlayer");

    div.innerHTML = `
      <b>${p.nickname}</b><br>
      패: ${p.hand.length}장<br>
      점수: ${p.score}<br>
      ${p.isOnline ? "" : "<span style='color:#aaa;'>오프라인</span>"}
    `;

    gamePlayerList.appendChild(div);
  });
}

// ======================================================
// HAND RENDER (SCOUT 삽입 +넣기 버튼 포함)
// ======================================================
function getDisplayedHand() {
  if (!flipReversed) return myHand;
  return myHand.map((c) => ({ top: c.bottom, bottom: c.top }));
}

function createInsertButton(pos) {
  const btn = document.createElement("button");
  btn.className = "insert-btn";
  btn.innerText = "+넣기";

  btn.onclick = () => {
    socket.emit("scout", {
      roomId,
      permUid: window.permUid,
      side: scoutTargetSide,
      flip: scoutFlip,
      pos: pos,
    });

    scoutMode = false;
    renderTable();
    renderHand();
  };

  const wrap = document.createElement("div");
  wrap.className = "insert-wrapper";
  wrap.appendChild(btn);
  return wrap;
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  const disp = getDisplayedHand();
  const allowInsert = (scoutMode && !flipSelect);

  if (allowInsert) handArea.appendChild(createInsertButton(0));

  disp.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    if (!scoutMode) {
      if (selected.has(i)) wrap.classList.add("selected");

      wrap.onclick = () => {
        if (flipSelect) return alert("패 방향을 먼저 확정하세요!");
        if (selected.has(i)) selected.delete(i);
        else selected.add(i);
        renderHand();
      };
    }

    wrap.appendChild(drawScoutCard(c.top, c.bottom));
    handArea.appendChild(wrap);

    if (allowInsert) handArea.appendChild(createInsertButton(i + 1));
  });
}

// ======================================================
// TABLE RENDER (3장 이상 양 끝만 SCOUT)
// ======================================================
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#555">(비어 있음)</span>`;
    return;
  }

  tableCards.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "table-card-wrapper";

    wrap.appendChild(drawScoutCard(c.top, c.bottom));

    const isFirst = idx === 0;
    const isLast = idx === tableCards.length - 1;

    const canScout =
      myTurn &&
      !flipSelect &&
      scoutMode &&
      (
        tableCards.length === 1 ||
        tableCards.length === 2 ||
        (tableCards.length >= 3 && (isFirst || isLast))
      );

    if (canScout) {
      wrap.classList.add("scout-glow");

      const btn = document.createElement("button");
      btn.className = "take-btn";
      btn.innerText = "가져오기";

      btn.onclick = () => {
        if (tableCards.length === 1) scoutTargetSide = "left";
        else scoutTargetSide = isFirst ? "left" : "right";

        scoutModal.classList.remove("hidden");
      };

      wrap.appendChild(btn);
    }

    tableArea.appendChild(wrap);
  });
}

// ======================================================
// SHOW
// ======================================================
showBtn.onclick = () => {
  if (!myTurn || flipSelect) return;

  const disp = getDisplayedHand();
  const chosen = Array.from(selected).map((i) => disp[i]);
  if (chosen.length === 0) return alert("카드를 선택하세요.");

  socket.emit("show", {
    roomId,
    permUid: window.permUid,
    cards: chosen,
  });
};

// ======================================================
// SCOUT 버튼
// ======================================================
scoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;
  if (tableCards.length === 0) return;

  scoutMode = true;
  renderTable();
};

// ======================================================
// SCOUT MODAL
// ======================================================
modalClose.onclick = () => scoutModal.classList.add("hidden");

modalKeep.onclick = () => {
  scoutFlip = false;
  scoutModal.classList.add("hidden");
  renderHand();
};

modalReverse.onclick = () => {
  scoutFlip = true;
  scoutModal.classList.add("hidden");
  renderHand();
};

// ======================================================
// TURN CHANGE
// ======================================================
socket.on("turnChange", (uid) => {
  myTurn = (uid === window.permUid);
  scoutMode = false;

  renderTable();
  renderHand();
});

// ======================================================
// SOCKET HANDLERS
// ======================================================
socket.on("playerListUpdate", (players) => {
  gamePlayers = players;   // roomUI의 LED 구조와 충돌 없음
  renderPlayers();
});

socket.on("roundStart", ({ round, players }) => {
  gamePlayers = players;
  tableCards = [];
  selected.clear();

  flipSelect   = true;
  flipReversed = false;
  scoutMode    = false;

  flipSelectArea.classList.remove("hidden");

  renderPlayers();
  renderTable();
  renderHand();

  roundInfo.innerText = `라운드 ${round}`;
});

socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  renderHand();
});

socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});
