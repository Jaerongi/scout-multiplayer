// ================================
// GAME UI FINAL v6
// ================================

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

// ===============================
// 상태 변수
// ===============================
let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let flipConfirmed = false;
let myTurn = false;
let flipWarnShown = false; // 첫 턴일 때만 안내

// ===============================
// 초기 flip UI 생성
// ===============================
const flipAllBtn = document.createElement("button");
flipAllBtn.innerText = "전체 방향 전환";
flipAllBtn.className = "btn-sub small";

const confirmFlipBtn = document.createElement("button");
confirmFlipBtn.innerText = "방향 확정";
confirmFlipBtn.className = "btn-green small";

document.querySelector("#myCount").parentElement.appendChild(flipAllBtn);
document.querySelector("#myCount").parentElement.appendChild(confirmFlipBtn);

// ===============================
// 플레이어 리스트 업데이트
// ===============================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

// ===============================
// 라운드 시작
// ===============================
socket.on("roundStart", ({ round, players: pl, startingPlayer }) => {
  players = pl;
  tableCards = [];
  flipConfirmed = false;
  flipWarnShown = false;

  roundInfo.innerText = `라운드 ${round}`;

  renderPlayers();
  renderTable();
});

// ===============================
// 내 패 받음
// ===============================
socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  flipConfirmed = false;

  flipAllBtn.style.display = "inline-block";
  confirmFlipBtn.style.display = "inline-block";

  renderHand();
});

// ===============================
// 턴 변경
// ===============================
socket.on("turnChange", (uid) => {
  myTurn = uid === myUid;
  highlightTurn(uid);

  if (myTurn && !flipConfirmed && !flipWarnShown) {
    alert("패 방향 확정 버튼을 눌러주세요!");
    flipWarnShown = true;
  }
});

// ===============================
// 테이블 갱신
// ===============================
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

// ===============================
// HAND 렌더링
// ===============================
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
        alert("패 방향 확정 후 선택할 수 있습니다!");
        return;
      }

      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);

      renderHand();
    };

    handArea.appendChild(div);
  });
}

// ===============================
// TABLE 렌더링
// ===============================
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

// ===============================
// 플레이어 리스트 렌더링
// ===============================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  const list = Object.values(players);

  list.forEach((p) => {
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

// ===============================
// 턴 표시 (모든 클라이언트가 동일하게)
// ===============================
function highlightTurn(turnUid) {
  const boxes = gamePlayerList.children;
  const list = Object.values(players);

  for (let i = 0; i < list.length; i++) {
    const box = boxes[i];
    if (list[i].uid === turnUid) {
      box.classList.add("turnGlow");
    } else {
      box.classList.remove("turnGlow");
    }
  }
}

// ===============================
// 전체 flip
// ===============================
flipAllBtn.onclick = () => {
  if (flipConfirmed) return;

  myHand = myHand.map(c => ({ top: c.bottom, bottom: c.top }));
  renderHand();
};

// 방향 확정
confirmFlipBtn.onclick = () => {
  flipConfirmed = true;

  flipAllBtn.style.display = "none";
  confirmFlipBtn.style.display = "none";

  socket.emit("confirmFlip", {
    roomId,
    flipped: myHand
  });
};

// ===============================
// SHOW
// ===============================
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

// ===============================
// SCOUT (좌/우 끝 카드)
// ===============================
//------------------------------------------------------
// SCOUT 버튼 — 위치 선택 + flip 선택 완전체
//------------------------------------------------------
scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향 확정 버튼을 먼저 눌러주세요.");

  if (tableCards.length === 0)
    return alert("테이블이 비어있습니다.");

  // 1) 왼쪽 / 오른쪽 선택
  const pickLeft = confirm(
    "왼쪽 카드를 가져올까요?\n취소 = 오른쪽 카드를 가져옵니다."
  );
  const side = pickLeft ? "left" : "right";

  // 2) flip 여부 선택
  const doFlip = confirm(
    "카드를 뒤집어서 가져올까요?\n확인 = flip / 취소 = 그대로"
  );

  // 3) 삽입 위치 선택 (0 ~ myHand.length)
  let pos = prompt(
    `카드를 어디에 넣을까요?\n0 = 맨 앞 / ${myHand.length} = 맨 뒤`
  );
  pos = parseInt(pos);
  if (isNaN(pos) || pos < 0 || pos > myHand.length) pos = myHand.length;

  // 서버 전달
  socket.emit("scout", {
    roomId,
    side,
    flip: doFlip,
    pos
  });
};


// ===============================
// SHOW & SCOUT (미구현)
// ===============================
showScoutBtn.onclick = () => {
  alert("추가 개발 예정 기능입니다!");
};



