// =======================================
// GAME UI — FINAL FULL VERSION (SCOUT PREVIEW ONLY)
// =======================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

// DOM
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// ========================================
// SCOUT 미리보기 DOM
// ========================================
const scoutPreview = document.createElement("div");
scoutPreview.id = "scoutPreview";
scoutPreview.style.marginTop = "12px";
scoutPreview.style.textAlign = "center";
scoutPreview.style.display = "none";
handArea.parentElement.appendChild(scoutPreview);

// 미리보기 렌더 함수
function renderScoutPreview(card) {
  if (!card) {
    scoutPreview.style.display = "none";
    scoutPreview.innerHTML = "";
    return;
  }

  scoutPreview.style.display = "block";
  scoutPreview.innerHTML = `
    <div style="color:white; margin-bottom:6px; font-size:14px;">가져올 카드 미리보기</div>
  `;
  scoutPreview.appendChild(drawScoutCard(card.top, card.bottom, 80, 120));
}

// 상태 변수
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let myTurn = false;

let flipConfirmed = false;  // 라운드 시작 시 false로 초기화

//---------------------------------------------------------
// flip 버튼 구성
//---------------------------------------------------------
const flipAllBtn = document.createElement("button");
flipAllBtn.innerText = "전체 방향 전환";
flipAllBtn.className = "btn-sub small";

const confirmFlipBtn = document.createElement("button");
confirmFlipBtn.innerText = "방향 확정";
confirmFlipBtn.className = "btn-green small";

document.querySelector("#myCount").parentElement.appendChild(flipAllBtn);
document.querySelector("#myCount").parentElement.appendChild(confirmFlipBtn);

// ========================================================
// 플레이어 리스트 업데이트
// ========================================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

// ========================================================
// 라운드 시작
// ========================================================
socket.on("roundStart", ({ round, players: p }) => {
  players = p;
  tableCards = [];

  flipConfirmed = false;     // 라운드마다 방향 미확정
  selected.clear();

  flipAllBtn.style.display = "inline-block";
  confirmFlipBtn.style.display = "inline-block";

  roundInfo.innerText = `라운드 ${round}`;

  renderPlayers();
  renderTable();
  renderScoutPreview(null);
});

// ========================================================
// 내 패 수신
// ========================================================
socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  renderHand();
  renderScoutPreview(null);
});

// ========================================================
// 턴 변경 — 팝업 없음!!
// ========================================================
socket.on("turnChange", (uid) => {
  myTurn = (uid === myUid);
  highlightTurn(uid);
});

// ========================================================
// 테이블 갱신
// ========================================================
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

// ========================================================
// TABLE 렌더링 + SCOUT 가능 카드 하이라이트 + 버튼용 영역 생성
// ========================================================
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#888">(비어 있음)</span>`;
    return;
  }

  let highlightIndex = [];

  if (tableCards.length === 1) {
    highlightIndex = [0];
  } else if (tableCards.length === 2) {
    highlightIndex = [0, 1];
  } else {
    highlightIndex = [0, tableCards.length - 1];
  }

  tableCards.forEach((c, idx) => {
    const cardElem = drawScoutCard(c.top, c.bottom, 90, 130);

    const wrap = document.createElement("div");
    wrap.style.display = "inline-block";
    wrap.style.margin = "0 10px";     // 🟢 테이블 카드 간격 넓힘
    wrap.style.textAlign = "center";
    wrap.appendChild(cardElem);

    if (highlightIndex.includes(idx)) {
      cardElem.classList.add("scout-highlight");

      // 버튼 영역
      const zone = document.createElement("div");
      zone.className = "scoutBtnZone";
      wrap.appendChild(zone);

      // 어떤 인덱스인지 표시
      wrap.dataset.index = idx;
    }

    tableArea.appendChild(wrap);
  });
}

// ========================================================
// HAND 렌더링 (누락되어서 패가 안 보였던 부분!!)
// ========================================================
function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((card, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    // 선택 표시
    if (selected.has(idx)) {
      wrap.classList.add("selected");
    }

    wrap.appendChild(drawScoutCard(card.top, card.bottom));

    wrap.onclick = () => {
      if (!flipConfirmed) {
        alert("패 방향 확정 후 선택 가능합니다!");
        return;
      }

      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);

      renderHand();
    };

    handArea.appendChild(wrap);
  });
}

// ========================================================
// 플레이어 리스트
// ========================================================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  const arr = Object.values(players);

  arr.forEach((p) => {
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

// ========================================================
// 턴 표시
// ========================================================
function highlightTurn(turnUid) {
  const boxes = gamePlayerList.children;
  const arr = Object.values(players);

  for (let i = 0; i < arr.length; i++) {
    const box = boxes[i];
    if (arr[i].uid === turnUid) box.classList.add("turnGlow");
    else box.classList.remove("turnGlow");
  }
}

// ========================================================
// FLIP 전체
// ========================================================
flipAllBtn.onclick = () => {
  if (flipConfirmed) return;

  myHand = myHand.map(c => ({ top: c.bottom, bottom: c.top }));
  renderHand();
};

// ========================================================
// 방향 확정
// ========================================================
confirmFlipBtn.onclick = () => {
  flipConfirmed = true;

  flipAllBtn.style.display = "none";
  confirmFlipBtn.style.display = "none";

  socket.emit("confirmFlip", {
    roomId,
    flipped: myHand
  });
};

// ========================================================
// SHOW
// ========================================================
showBtn.onclick = () => {
  if (!myTurn) return alert("내 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향을 확정해주세요.");
  if (selected.size === 0) return alert("카드를 선택하세요.");

  const cards = [...selected].map(i => myHand[i]);

  if (getComboType(cards) === "invalid")
    return alert("세트 또는 런이 아닙니다.");

  if (!isStrongerCombo(cards, tableCards))
    return alert("기존 테이블보다 약합니다.");

  socket.emit("show", { roomId, cards });
  selected.clear();
  renderScoutPreview(null);
};

// ========================================================
// SCOUT 버튼 → 선택 버튼 생성
// ========================================================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향을 먼저 확정해주세요.");
  if (tableCards.length === 0) return alert("테이블이 비어있습니다.");

  // 기존 버튼 제거
  document.querySelectorAll(".scoutSelectBtn").forEach(b => b.remove());

  // 하이라이트된 카드 아래 버튼 생성
  document.querySelectorAll(".scoutBtnZone").forEach(zone => {
    const idx = parseInt(zone.parentElement.dataset.index);
    const side = (idx === 0 ? "left" : "right");

    const btnKeep = document.createElement("button");
    btnKeep.innerText = "그대로 가져오기";
    btnKeep.className = "btn-green small scoutSelectBtn";
    btnKeep.onclick = () => performScout(side, false);

    const btnFlip = document.createElement("button");
    btnFlip.innerText = "반대로 가져오기";
    btnFlip.className = "btn-sub small scoutSelectBtn";
    btnFlip.onclick = () => performScout(side, true);

    zone.appendChild(btnKeep);
    zone.appendChild(btnFlip);
  });
};

// ========================================================
// SHOW+SCOUT (미구현)
// ========================================================
showScoutBtn.onclick = () => {
  alert("아직 준비되지 않은 기능입니다!");
};








