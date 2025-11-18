// ======================================================
// GAME UI — 회원 기반 + 모든 시스템 최종 통합
// ======================================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

const scoutModal = document.getElementById("scoutModal");
const modalKeep = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose = document.getElementById("modalClose");

let players = {};
let tableCards = [];
let myHand = [];

let selected = new Set();
let myTurn = false;

let flipSelect = true;
let flipReversed = false;

let scoutMode = false;
let scoutTargetSide = null;
let scoutFlip = false;

let insertMode = false;
let insertCardInfo = null;


// ------------------------------- PLAYER RENDER
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox";
    if (!p.isOnline) div.classList.add("offlinePlayer");

    div.innerHTML = `
      <b>${p.nickname}</b><br>
      패: ${p.hand.length}장<br>
      점수: ${p.score}
    `;

    gamePlayerList.appendChild(div);
  });
}


// ------------------------------- HAND RENDER
function getDisplayedHand() {
  return flipReversed
    ? myHand.map((c) => ({ top:c.bottom, bottom:c.top }))
    : myHand;
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  const disp = getDisplayedHand();

  const makeInsertButton = (pos) => {
    const btn = document.createElement("button");
    btn.className = "insert-btn";
    btn.innerText = "+ 넣기";

    btn.onclick = () => {
      insertMode = false;

      socket.emit("scout", {
        roomId,
        userId: window.userId,
        side: insertCardInfo.side,
        flip: insertCardInfo.flip,
        pos
      });

      renderHand();
    };

    return btn;
  };

  if (insertMode) handArea.appendChild(makeInsertButton(0));

  disp.forEach((c,i)=>{
    const w = document.createElement("div");
    w.className = "card-wrapper";

    if (!insertMode) {
      if (selected.has(i)) w.classList.add("selected");

      w.onclick = () => {
        if (flipSelect) return alert("패 방향을 먼저 확정해주세요!");
        if (insertMode) return;

        if (selected.has(i)) selected.delete(i);
        else selected.add(i);

        renderHand();
      };
    }

    w.appendChild(drawScoutCard(c.top, c.bottom));
    handArea.appendChild(w);

    if (insertMode) handArea.appendChild(makeInsertButton(i+1));
  });
}


// ------------------------------- TABLE RENDER
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#999">(비어있음)</span>`;
    return;
  }

  tableCards.forEach((c, idx)=>{
    const w = document.createElement("div");
    w.className = "table-card-wrapper";
    w.appendChild(drawScoutCard(c.top, c.bottom));

    const canScout =
      myTurn &&
      !flipSelect &&
      scoutMode &&
      (tableCards.length === 1 || idx === 0 || idx === tableCards.length-1);

    if (canScout) {
      w.classList.add("scout-glow");

      const btn = document.createElement("button");
      btn.className = "take-btn";
      btn.innerText = "가져오기";
      btn.onclick = ()=>{
        if (tableCards.length === 1) scoutTargetSide="left";
        else if (idx === 0) scoutTargetSide="left";
        else scoutTargetSide="right";

        scoutModal.classList.remove("hidden");
      };

      w.appendChild(btn);
    }

    tableArea.appendChild(w);
  });
}


// ------------------------------- TURN HIGHLIGHT
function highlightTurn(uid) {
  const arr = Object.values(players);
  const divs = gamePlayerList.children;

  arr.forEach((p,i)=>{
    if (p.uid === uid) divs[i].classList.add("turnGlow");
    else divs[i].classList.remove("turnGlow");
  });
}


// ------------------------------- BUTTON ACTIVE
function updateActionButtons() {
  const b = myTurn && !flipSelect;
  [showBtn, scoutBtn, showScoutBtn].forEach(btn=>{
    btn.disabled = !b;
    btn.style.opacity = b ? "1" : "0.4";
  });
}


// ------------------------------- SHOW LOGIC
showBtn.onclick = () => {
  if (!myTurn || flipSelect) return;

  const disp = getDisplayedHand();
  const chosen = Array.from(selected).map(i=>disp[i]);

  if (chosen.length === 0) return alert("카드를 선택하세요.");

  const combo = getComboType(chosen);
  if (combo === "invalid") {
    return alert("SET 또는 RUN 조합만 낼 수 있습니다!");
  }

  if (tableCards.length > 0) {
    if (!isStrongerCombo(chosen, tableCards)) {
      return alert("테이블보다 강해야 합니다!");
    }
  }

  socket.emit("show", {
    roomId,
    userId: window.userId,
    cards: chosen
  });
};


// ------------------------------- SCOUT LOGIC
scoutBtn.onclick = () => {
  if (!myTurn || flipSelect) return;
  if (tableCards.length === 0) return;

  scoutMode = true;
  renderTable();
};


// ------------------------------- SCOUT MODAL
modalClose.onclick = ()=> scoutModal.classList.add("hidden");

modalKeep.onclick = ()=>{
  scoutModal.classList.add("hidden");
  scoutMode = false;

  insertMode = true;
  insertCardInfo = { side:scoutTargetSide, flip:false };

  renderHand();
  renderTable();
};

modalReverse.onclick = ()=>{
  scoutModal.classList.add("hidden");
  scoutMode = false;

  insertMode = true;
  insertCardInfo = { side:scoutTargetSide, flip:true };

  renderHand();
  renderTable();
};


// ------------------------------- FLIP
flipToggleBtn.onclick = ()=>{
  flipReversed = !flipReversed;
  renderHand();
};

flipConfirmBtn.onclick = ()=>{
  flipSelect = false;
  flipSelectArea.classList.add("hidden");
  updateActionButtons();
};


// ======================================================
// SOCKET EVENTS
// ======================================================
socket.on("playerListUpdate", (p)=>{
  players = p;
  renderPlayers();
});

socket.on("roundStart", ({round, players:p})=>{
  players = p;
  tableCards = [];
  selected.clear();

  flipSelect = true;
  flipReversed = false;
  scoutMode = false;
  insertMode = false;

  flipSelectArea.classList.remove("hidden");

  renderPlayers();
  renderTable();
  renderHand();

  roundInfo.innerText = `라운드 ${round}`;
  updateActionButtons();
});

socket.on("yourHand", hand=>{
  myHand = hand;
  selected.clear();
  insertMode = false;
  renderHand();
  updateActionButtons();
});

socket.on("tableUpdate", cards=>{
  tableCards = cards;
  renderTable();
  updateActionButtons();
});

socket.on("roundEnd", ({winner, players})=>{
  const name = players[winner].nickname;

  const div = document.createElement("div");
  div.className = "modal";
  div.innerHTML = `
    <div class="modal-box">
      <h2>라운드 승자</h2>
      <h1>${name}</h1>
    </div>
  `;
  document.body.appendChild(div);

  setTimeout(()=>div.remove(), 3000);
});

socket.on("gameOver", ({winner, players})=>{
  const name = players[winner].nickname;

  const div = document.createElement("div");
  div.className = "modal";
  div.innerHTML = `
    <div class="modal-box">
      <h2>최종 우승자 🎉</h2>
      <h1>${name}</h1><br>
      <button id="restartBtn" class="btn-main">재경기 시작</button>
    </div>
  `;

  document.body.appendChild(div);

  document.getElementById("restartBtn").onclick = ()=>{
    div.remove();
    socket.emit("startGame",{
      roomId,
      userId:window.userId
    });
  };
});

socket.on("turnChange", uid=>{
  myTurn = (uid === window.userId);

  scoutMode = false;
  insertMode = false;

  highlightTurn(uid);
  renderTable();
  renderHand();
  updateActionButtons();
});
