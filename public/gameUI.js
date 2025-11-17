// =======================================
// GAME UI — FINAL FIXED V2 (안정버전)
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

// 상태 변수
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let myTurn = false;

let flipConfirmed = false;  // 라운드마다 false로 초기화

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
});

// ========================================================
// 내 패 수신
// ========================================================
socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  renderHand();
});

// ========================================================
// 턴 변경 — 절대 팝업 없음!!
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
// 테이블 렌더링
// ========================================================
function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#888">(비어 있음)</span>`;
    return;
  }

  tableCards.forEach((c) => {
    tableArea.appendChild(drawScoutCard(c.top, c.bottom, 90, 130));
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
// flipAll
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
};

// ========================================================
// SCOUT
// ========================================================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향을 먼저 확정해주세요.");
  if (tableCards.length === 0) return alert("테이블이 비어있습니다.");

  const pickLeft = confirm("왼쪽 카드를 가져올까요?\n취소 = 오른쪽");
  const side = pickLeft ? "left" : "right";

  const doFlip = confirm("카드를 뒤집어서 가져올까요?");

  let pos = prompt(`카드를 어디에 넣을까요? (0 ~ ${myHand.length})`);
  pos = parseInt(pos);
  if (isNaN(pos) || pos < 0 || pos > myHand.length) pos = myHand.length;

  socket.emit("scout", {
    roomId,
    side,
    flip: doFlip,
    pos
  });
};

// ========================================================
// SHOW+SCOUT (미구현)
// ========================================================
showScoutBtn.onclick = () => {
  alert("아직 준비되지 않은 기능입니다!");
};
