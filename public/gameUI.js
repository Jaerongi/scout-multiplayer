// =========================================
// SCOUT – GAME PAGE LOGIC (최종 완성본)
// =========================================

// DOM
const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

// Buttons
const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const passBtn = document.getElementById("passBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// GAME STATE
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let flipState = {};
let myTurn = false;

let showScoutUsed = false;   // 1회성 스킬

// =========================================
// 렌더링 – 플레이어 목록
// =========================================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
});

function renderPlayerList() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const box = document.createElement("div");
    box.className = "playerBox";
    if (p.uid === myUid) box.style.background = "#383838";

    if (p.isTurn) box.classList.add("turn-now");

    box.innerHTML = `
      <b>${p.nickname}</b><br>
      패: ${p.handCount}장<br>
      점수: ${p.score}
    `;

    gamePlayerList.appendChild(box);
  });
}

// =========================================
// 턴 변경
// =========================================
socket.on("turnChange", (uid) => {
  myTurn = uid === myUid;

  Object.values(players).forEach((p) => (p.isTurn = false));
  if (players[uid]) players[uid].isTurn = true;

  renderPlayerList();
});

// =========================================
// 라운드 시작
// =========================================
socket.on("roundStart", ({ round, players: p, startingPlayer }) => {
  players = p;
  tableCards = [];
  selected.clear();
  flipState = {};
  showScoutUsed = false;

  roundInfo.innerText = `라운드 ${round}`;
  myTurn = startingPlayer === myUid;

  Object.values(players).forEach((x) => (x.isTurn = false));
  players[startingPlayer].isTurn = true;

  renderPlayerList();
  renderTable();
  renderHand();
});

// =========================================
// 내 손패 수신
// =========================================
socket.on("yourHand", (handData) => {
  myHand = handData;
  selected.clear();
  flipState = {};

  renderHand();
});

// =========================================
// 손패 개수 업데이트
// =========================================
socket.on("handCountUpdate", (counts) => {
  for (const uid in players) {
    if (players[uid]) players[uid].handCount = counts[uid];
  }
  renderPlayerList();
});

// =========================================
// 테이블 갱신
// =========================================
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

// =========================================
// 테이블 렌더링
// =========================================
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

// =========================================
// 손패 렌더링 (삽입 슬롯 포함)
// =========================================
function renderHand(showInsert = false) {

  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  // 0번 위치 앞 삽입 슬롯
  if (showInsert) addInsertSlot(0);

  myHand.forEach((card, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "card-wrapper";

    const flipped = flipState[idx] === "bottom";
    const c = flipped ? { top: card.bottom, bottom: card.top } : card;

    if (selected.has(idx)) wrapper.classList.add("selected");
    wrapper.append(drawScoutCard(c.top, c.bottom));

    // flip
    const flipBtn = document.createElement("div");
    flipBtn.className = "flip-btn";
    flipBtn.innerText = "↻";
    flipBtn.onclick = (e) => {
      e.stopPropagation();
      flipState[idx] = flipped ? "top" : "bottom";
      renderHand(showInsert);
    };
    wrapper.append(flipBtn);

    wrapper.onclick = () => {
      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);
      renderHand(showInsert);
    };

    handArea.append(wrapper);

    if (showInsert) addInsertSlot(idx + 1);
  });
}

function addInsertSlot(position) {
  const slot = document.createElement("div");
  slot.className = "insert-slot";
  slot.innerText = "+";
  slot.onclick = () => {
    window.showScoutInsert(position);
  };
  handArea.append(slot);
}

// =========================================
// SHOW
// =========================================
showBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (selected.size === 0) return alert("카드를 선택하세요.");

  const selectedCards = [...selected].map(i => {
    const c = myHand[i];
    return flipState[i] === "bottom"
      ? { top: c.bottom, bottom: c.top }
      : c;
  });

  if (getComboType(selectedCards) === "invalid")
    return alert("세트/런이 아닙니다.");

  if (!isStrongerCombo(selectedCards, tableCards))
    return alert("기존 테이블보다 약합니다.");

  socket.emit("show", { roomId, cards: selectedCards });

  selected.clear();
  flipState = {};
};

// =========================================
// SCOUT
// =========================================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (tableCards.length !== 1)
    return alert("스카우트는 테이블 카드가 1장일 때만 가능");

  const t = tableCards[0];
  const pickBottom = confirm(
    `bottom(${t.bottom}) 가져올까요?\n취소 = top(${t.top})`
  );

  socket.emit("scout", {
    roomId,
    chosenValue: pickBottom ? "bottom" : "top",
  });

  selected.clear();
};

// =========================================
// PASS
// =========================================
passBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  socket.emit("pass", { roomId });
};

// ====================================================
// SHOW & SCOUT (1회성)
// ====================================================
showScoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (showScoutUsed) return alert("이미 사용했습니다.");
  if (tableCards.length !== 1)
    return alert("테이블에 카드가 1장일 때만 가능");

  const t = tableCards[0];
  const pickBottom = confirm(
    `Show & Scout\n확인 = bottom(${t.bottom})\n취소 = top(${t.top})`
  );

  const newCard = pickBottom
    ? { top: t.bottom, bottom: t.top }
    : { top: t.top, bottom: t.bottom };

  window.__pendingShowScoutCard = newCard;

  alert("손패에 넣을 위치를 선택하세요 (+ 버튼)");

  renderHand(true);
};

// =========================================
// INSERT 슬롯 클릭 시
// =========================================
window.showScoutInsert = function (pos) {
  const card = window.__pendingShowScoutCard;
  if (!card) return;

  // 원본 손패 복원용 저장
  window.__backupHand = JSON.parse(JSON.stringify(myHand));

  // 삽입
  myHand.splice(pos, 0, card);

  // 삽입 후 취소 버튼 추가
  renderHand();
  renderInsertCancelButton();
};

// =========================================
// 삽입 취소 버튼
// =========================================
function renderInsertCancelButton() {
  const div = document.createElement("div");
  div.style.marginTop = "15px";

  const btn = document.createElement("button");
  btn.className = "btn-sub same";
  btn.innerText = "취소 (원래대로)";
  btn.onclick = () => {
    myHand = window.__backupHand;
    window.__pendingShowScoutCard = null;
    renderHand();
  };

  div.append(btn);
  handArea.append(div);
}
