// ======================================================
// GAME UI — 완전 안정버전 (READY LED + FLIP FIX + SCOUT + INSERT)
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
const showBtn     = document.getElementById("showBtn");
const scoutBtn    = document.getElementById("scoutBtn");

// Flip Select
const flipSelectArea  = document.getElementById("flipSelectArea");
const flipToggleBtn   = document.getElementById("flipToggleBtn");
const flipConfirmBtn  = document.getElementById("flipConfirmBtn");

// SCOUT Modal
const scoutModal   = document.getElementById("scoutModal");
const modalKeep    = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose   = document.getElementById("modalClose");

// ======================================================
// STATE (이름 충돌 방지 - gamePlayers 로 변경)
// ======================================================
let gamePlayers = {};
let tableCards  = [];
let myHand      = [];
let selected    = new Set();

let myTurn        = false;
let flipSelect    = true;     // 방향 선택 중
let flipReversed  = false;    // false=정위치 / true=뒤집힘

let scoutMode       = false;  // SCOUT 중인지
let scoutTargetSide = null;   // 'left' / 'right'
let scoutFlip        = false; // false=그대로 / true=반대로

// ======================================================
// PLAYER LIST RENDER
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
      ${!p.isOnline ? "<span style='color:#aaa;'>오프라인</span>" : ""}
    `;

    gamePlayerList.appendChild(div);
  });
}

// ======================================================
// HAND RENDER + INSERT BUTTON
// ======================================================
function getDisplayedHand() {
  if (!flipReversed) return myHand;

  // 뒤집기 적용 버전
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

    // SCOUT 종료
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

  // ❗ 방향 선택 중이면 SCOUT 삽입 버튼 절대 생성 금지
  const allowInsert = (scoutMode && !flipSelect);

  // 맨 앞 insert 버튼
  if (allowInsert) {
    handArea.appendChild(createInsertButton(0));
  }

  disp.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    // SCOUT 상태가 아닐 때 SHOW 카드 선택 동작
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

    // 카드 뒤 insert 버튼
    if (allowInsert) {
      handArea.appendChild(createInsertButton(i + 1));
    }
  });
}
// ======================================================
// TABLE RENDER (SCOUT: 양 끝만 가능)
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

    // SCOUT 가능한 위치 조건
    const isFirst  = (idx === 0);
    const isLast   = (idx === tableCards.length - 1);
    const canScout =
      myTurn &&
      !flipSelect &&
      scoutMode &&
      (
        tableCards.length === 1 ||                // 1장일 때
        (tableCards.length === 2) ||             // 2장은 양쪽
        (tableCards.length >= 3 && (isFirst || isLast))  // 3장이상 양끝만
      );

    if (canScout) {
      wrap.classList.add("scout-glow");

      const btn = document.createElement("button");
      btn.className = "take-btn";
      btn.innerText = "가져오기";

      btn.onclick = () => {
        if (tableCards.length === 1) {
          scoutTargetSide = "left";
        } else if (isFirst) {
          scoutTargetSide = "left";
        } else {
          scoutTargetSide = "right";
        }

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

  const disp   = getDisplayedHand();
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

  scoutMode = true;     // SCOUT 모드 진입
  renderTable();
};

// ======================================================
// SCOUT MODAL
// ======================================================
modalClose.onclick = () => {
  scoutModal.classList.add("hidden");
};

modalKeep.onclick = () => {
  scoutFlip = false;
  scoutModal.classList.add("hidden");

  // 이제 hand에 +넣기 버튼 띄워서 위치 선택
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

  // SCOUT 모드는 턴 바뀌면 자동 초기화
  scoutMode = false;

  renderTable();
  renderHand();
});

// ======================================================
// SOCKET EVENTS
// ======================================================
socket.on("playerListUpdate", (players) => {
  // 여기서는 gamePlayers 로만 저장 (대기실 LED 오류 제거)
  gamePlayers = players;
  renderPlayers();     // 게임화면의 플레이어 리스트만 업데이트
});

socket.on("roundStart", ({ round, players }) => {
  // 새 라운드 시작 — 내 hand/table 상태 초기화
  gamePlayers = players;
  tableCards  = [];
  selected.clear();

  flipSelect    = true;
  flipReversed  = false;
  scoutMode     = false;

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


