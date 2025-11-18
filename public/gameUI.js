// ======================================================
// GAME UI — SCOUT 패 방향 선택 + SHOW + SCOUT + TURN UI
// (A안 적용: 카드 아래 "가져오기" 버튼 생성)
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
const showScoutBtn = document.getElementById("showScoutBtn");

// Flip select UI
const flipSelectArea = document.getElementById("flipSelectArea");
const flipToggleBtn = document.getElementById("flipToggleBtn");
const flipConfirmBtn = document.getElementById("flipConfirmBtn");

// SCOUT modal
const scoutModal = document.getElementById("scoutModal");
const modalKeep = document.getElementById("modalKeep");
const modalReverse = document.getElementById("modalReverse");
const modalClose = document.getElementById("modalClose");

// Insert position modal
const insertModal = document.getElementById("insertModal");
const insertModalContent = document.getElementById("insertModalContent");

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

// SCOUT 기능 상태
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
// 핸드 렌더링
// ======================================================
function getDisplayedHand() {
  if (!flipReversed) return myHand;
  return myHand.map((c) => ({ top: c.bottom, bottom: c.top }));
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  const disp = getDisplayedHand();

  disp.forEach((c, i) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    if (selected.has(i)) wrap.classList.add("selected");

    wrap.onclick = () => {
      if (flipSelect) return alert("패 방향을 먼저 확정하세요!");

      if (selected.has(i)) selected.delete(i);
      else selected.add(i);

      renderHand();
    };

    wrap.appendChild(drawScoutCard(c.top, c.bottom));
    handArea.appendChild(wrap);
  });
}

// ======================================================
// 테이블 렌더링 (A안 적용: 카드 아래 "가져오기" 버튼)
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

    // 카드 이미지
    const cardCanvas = drawScoutCard(c.top, c.bottom);
    wrap.appendChild(cardCanvas);

    // SCOUT 가능한지 체크
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
        // 어떤 쪽인지 결정
        if (tableCards.length === 1) {
          scoutTargetSide = "left";
        } else if (idx === 0) {
          scoutTargetSide = "left";
        } else if (idx === tableCards.length - 1) {
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
// 턴 하이라이트
// ======================================================
function highlightTurn(uid) {
  const arr = Object.values(players);
  const boxes = gamePlayerList.children;

  arr.forEach((p, i) => {
    if (p.uid === uid) boxes[i].classList.add("turnGlow");
    else boxes[i].classList.remove("turnGlow");
  });
}

// ======================================================
// 버튼 활성화
// ======================================================
function updateActionButtons() {
  const active = myTurn && !flipSelect;
  [showBtn, scoutBtn, showScoutBtn].forEach((btn) => {
    btn.disabled = !active;
    btn.style.opacity = active ? "1" : "0.4";
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

// 모달 동작
modalClose.onclick = () => scoutModal.classList.add("hidden");

modalKeep.onclick = () => {
  scoutFlip = false;
  scoutModal.classList.add("hidden");
  chooseInsertPosition();
};

modalReverse.onclick = () => {
  scoutFlip = true;
  scoutModal.classList.add("hidden");
  chooseInsertPosition();
};

// ======================================================
// 삽입 위치 선택
// ======================================================
function chooseInsertPosition() {
  insertModalContent.innerHTML = `<h3>삽입 위치 선택</h3><br>`;

  for (let i = 0; i <= myHand.length; i++) {
    const btn = document.createElement("button");
    btn.innerText = `${i} 번째`;
    btn.className = "btn-main small";
    btn.style.margin = "4px";

    btn.onclick = () => {
      insertModal.classList.add("hidden");

      socket.emit("scout", {
        roomId,
        permUid: window.permUid,
        side: scoutTargetSide,
        flip: scoutFlip,
        pos: i,
      });

      scoutMode = false;
      renderTable();
    };

    insertModalContent.appendChild(btn);
  }

  const close = document.createElement("button");
  close.innerText = "닫기";
  close.className = "btn-sub small";
  close.onclick = () => insertModal.classList.add("hidden");

  insertModalContent.appendChild(document.createElement("br"));
  insertModalContent.appendChild(close);

  insertModal.classList.remove("hidden");
}

// ======================================================
// 패 방향 선택 UI
// ======================================================
flipToggleBtn.onclick = () => {
  flipReversed = !flipReversed;
  renderHand();
};

flipConfirmBtn.onclick = () => {
  flipSelect = false;
  flipSelectArea.classList.add("hidden");
  updateActionButtons();
};

// ======================================================
// SOCKET EVENTS
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
  updateActionButtons();
});

socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  renderHand();
  updateActionButtons();
});

socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
  updateActionButtons();
});

// 턴 변경
socket.on("turnChange", (uid) => {
  myTurn = uid === window.permUid;

  // 턴 넘어가면 SCOUT 모드 종료
  scoutMode = false;

  highlightTurn(uid);
  renderTable();
  updateActionButtons();
});

