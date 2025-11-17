// ======================================
// GAME UI FINAL v3.6
// ======================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "../../shared.js";

const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");
const roundInfo = document.getElementById("roundInfo");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");
const showScoutBtn = document.getElementById("showScoutBtn");

// =========================
// 카드 방향 전환 관련 버튼
// =========================
let flipConfirmed = false;
let myTurn = false;

const flipAllBtn = document.getElementById("flipAllBtn");
const confirmFlipBtn = document.getElementById("confirmFlipBtn");

let myHand = [];
let players = {};
let tableCards = [];
let selected = new Set();

// =========================
// 패 받기
// =========================
socket.on("yourHand", (hand) => {
  myHand = hand;
  renderHand();
});

// =========================
// 플레이어 리스트 업데이트
// =========================
socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayers();
});

// =========================
// 라운드 시작
// =========================
socket.on("roundStart", ({ round }) => {
  flipConfirmed = false;
  roundInfo.innerText = `라운드 ${round}`;

  confirmFlipBtn.style.display = "inline-block";
  flipAllBtn.style.display = "inline-block";

  renderPlayers();
  renderTable();
});

// =========================
// 턴 변경
// =========================
socket.on("turnChange", (uid) => {
  myTurn = uid === myUid;

  highlightTurn(uid);

  if (myTurn && !flipConfirmed) {
    alert("패 방향 확정 버튼을 눌러주세요!");
  }
});

// =========================
// 테이블 업데이트
// =========================
socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

// =========================
// 플레이어 UI
// =========================
function renderPlayers() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox";

    div.innerHTML = `
      <b>${p.nickname}</b><br>
      패: ${p.hand.length}장<br>
      점수: ${p.score}
    `;

    div.dataset.uid = p.uid;
    gamePlayerList.appendChild(div);
  });
}

function highlightTurn(uid) {
  [...gamePlayerList.children].forEach((box) => {
    if (box.dataset.uid === uid) box.classList.add("turnGlow");
    else box.classList.remove("turnGlow");
  });
}

// =========================
// 테이블 출력
// =========================
function renderTable() {
  tableArea.innerHTML = "";
  if (tableCards.length === 0) {
    tableArea.innerHTML = `<span style="color:#777">(비어 있음)</span>`;
    return;
  }
  tableCards.forEach((c) => {
    tableArea.append(drawScoutCard(c.top, c.bottom, 90, 130));
  });
}

// =========================
// 패 출력
// =========================
function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((c, idx) => {
    const div = document.createElement("div");
    div.className = "card-wrapper";

    if (selected.has(idx)) div.classList.add("selected");

    div.append(drawScoutCard(c.top, c.bottom));

    div.onclick = () => {
      if (!flipConfirmed) {
        alert("패 방향 확정 먼저 해주세요!");
        return;
      }
      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);
      renderHand();
    };

    handArea.append(div);
  });
}

// =========================
// 전체 flip
// =========================
flipAllBtn.onclick = () => {
  if (flipConfirmed) return;

  myHand = myHand.map((c) => ({
    top: c.bottom,
    bottom: c.top
  }));

  renderHand();
};

// =========================
// 방향 확정
// =========================
confirmFlipBtn.onclick = () => {
  flipConfirmed = true;
  confirmFlipBtn.style.display = "none";

  socket.emit("confirmFlip", {
    roomId,
    flipped: myHand
  });
};

// =========================
// SHOW
// =========================
showBtn.onclick = () => {
  if (!myTurn) return alert("내 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향 확정 후 사용 가능합니다.");
  if (selected.size === 0) return alert("카드를 선택하세요.");

  const selectedCards = [...selected].map(i => myHand[i]);

  if (getComboType(selectedCards) === "invalid")
    return alert("세트/런 조합이 아닙니다.");

  if (!isStrongerCombo(selectedCards, tableCards))
    return alert("기존 테이블보다 약합니다!");

  socket.emit("show", { roomId, cards: selectedCards });
  selected.clear();
};

// =========================
// SCOUT
// =========================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("내 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향 확정 후 사용 가능합니다.");

  if (tableCards.length === 0) return alert("테이블이 비어 있음.");

  const side = confirm("왼쪽 카드 가져올까요?\n취소=오른쪽")
    ? "left"
    : "right";

  const flipped = confirm("뒤집어서 가져올까요? true/false");

  let insertIndex = parseInt(prompt(
    `어디에 넣을까요? 0=맨앞, ${myHand.length}=맨뒤`
  ));
  if (isNaN(insertIndex)) insertIndex = myHand.length;

  socket.emit("scout", { roomId, side, flipped, insertIndex });
};

// =========================
// SHOW & SCOUT (미구현)
// =========================
showScoutBtn.onclick = () => {
  alert("SHOW & SCOUT 미구현 (원하면 구현 가능)");
};



