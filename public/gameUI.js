// ======================================================
// GAME UI — SCOUT 전체 기능 완성본 (모달 1개만 사용)
// ======================================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// DOM Elements
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

// Buttons
const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");

// Flip select
const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

// SCOUT modal (1개만 사용)
const scoutModal = document.getElementById("scoutModal");
const modalKeep = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose = document.getElementById("modalClose");

// ======================================================
// STATE
// ======================================================
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

// ======================================================
// 플레이어 리스트
// ======================================================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
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
// 핸드 렌더링 (+넣기 기능)
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

  // 0번째 앞에 insert
  if (scoutMode && !flipSelect) {
    handArea.appendChild(createInsertButton(0));
  }

  disp.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    // SHOW 모드일 때만 선택 가능
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

    // insert 버튼 생성
    if (scoutMode && !flipSelect) {
      handArea.appendChild(createInsertButton(i + 1));
    }
  });
}

// ======================================================
// 테이블 렌더링 (끝만 가져오기 가능)
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

    const canScout =
      myTurn &&
      !flipSelect &&
      scoutMode &&
      (
        tableCards.length === 1 ||
        (tableCards.length === 2 && (idx === 0 || idx === 1)) ||
        (tableCards.length >= 3 && (idx === 0 || idx === tableCards.length - 1))
      );

    if (canScout) {
      wrap.classList.add("scout-glow");

      const btn = document.createElement("button");
      btn.className = "take-btn";
      btn.innerText = "가져오기";

      btn.onclick = () => {
        scoutTargetSide = 
          (tableCards.length === 1 || idx === 0) ? "left" : "right";

        scoutModal.classList.remove("hidden");
      };

      wrap.appendChild(btn);
    }

    tableArea.appendChild(wrap);
  });
}

// ======================================================
// 모달 동작 (insertModal 없음)
// ======================================================
modalClose.onclick = () => scoutModal.classList.add("hidden");

modalKeep.onclick = () => {
  scoutFlip = false;
  scoutModal.classList.add("hidden");

  // 💥 삽입 모달 대신 손패에 +넣기 버튼 즉시 생성
  renderHand();
};

modalReverse.onclick = () => {
  scoutFlip = true;
  scoutModal.classList.add("hidden");

  // 💥 삽입 모달 대신 손패에 +넣기 버튼 즉시 생성
  renderHand();
};

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
// 턴 변경
// ======================================================
socket.on("turnChange", (uid) => {
  myTurn = uid === window.permUid;
  scoutMode = false;

  renderTable();
  renderHand();
});

// ======================================================
// 소켓 이벤트 (기본 유지)
// ======================================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

socket.on("roundStart", ({ round, players: p }) => {
  players = p;
  tableCards = [];
  selected.clear();

  flipSelect = true;
  flipReversed = false;
  scoutMode = false;

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
