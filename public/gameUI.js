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
// 패 렌더링
// ========================================================
function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((card, idx) => {
    const div = document.createElement("div");
    div.className = "card-wrapper";

    if (selected.has(idx)) div.classList.add("selected");
    div.appendChild(drawScoutCard(card.top, card.bottom));

    div.onclick = () => {
      if (!flipConfirmed) {
        alert("패 방향 확정 후 선택 가능합니다!");
        return;
      }

      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);

      renderHand();
    };

    handArea.appendChild(div);
  });
}

// ========================================================
// TABLE 렌더링 + SCOUT 가능 카드 하이라이트 + 클릭 SCOUT
// ========================================================
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#888">(비어 있음)</span>`;
    return;
  }

  // SCOUT 가능 카드 인덱스 계산
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

    // 테두리 안겹치게 간격 적용
    const wrap = document.createElement("div");
    wrap.style.display = "inline-block";
    wrap.style.margin = "0 6px"; // ★ 간격 조금 넓힘
    wrap.appendChild(cardElem);

    // 하이라이트 대상이면 애니메이션
    if (highlightIndex.includes(idx)) {
      cardElem.classList.add("scout-highlight");

      // 클릭하면


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
// SCOUT — 기존 confirm 방식 + 미리보기 추가
// ========================================================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향을 먼저 확정해주세요.");
  if (tableCards.length === 0) return alert("테이블이 비어있습니다.");

  // ---------------------------
  // 1. 가져올 카드 방향 선택
  // ---------------------------
  const pickLeft = confirm("왼쪽 카드를 가져올까요?\n취소 = 오른쪽");
  const side = pickLeft ? "left" : "right";

  let targetCard = null;

  if (tableCards.length === 1) {
    targetCard = tableCards[0];
  } else {
    targetCard = pickLeft ? tableCards[0] : tableCards[tableCards.length - 1];
  }

  // 미리보기 출력
  renderScoutPreview(targetCard);

  // ---------------------------
  // 2. 뒤집을지 여부
  // ---------------------------
  const doFlip = confirm("카드를 뒤집어서 가져올까요?");
  if (doFlip) {
    targetCard = { top: targetCard.bottom, bottom: targetCard.top };
    renderScoutPreview(targetCard); // flip 적용된 모습 갱신
  }

  // ---------------------------
  // 3. 삽입 위치 선택
  // ---------------------------
  let pos = prompt(
    `카드를 어디에 넣을까요?\n0 = 맨 앞 / ${myHand.length} = 맨 뒤`
  );
  pos = parseInt(pos);
  if (isNaN(pos) || pos < 0 || pos > myHand.length) pos = myHand.length;

  // ---------------------------
  // 4. 서버 전달
  // ---------------------------
  socket.emit("scout", {
    roomId,
    side,
    flip: doFlip,
    pos
  });

  // SCOUT 완료 → 미리보기 자동 제거
  setTimeout(() => renderScoutPreview(null), 1000);
};

// ========================================================
// SHOW+SCOUT (미구현)
// ========================================================
showScoutBtn.onclick = () => {
  alert("아직 준비되지 않은 기능입니다!");
};


