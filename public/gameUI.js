// ================================
// GAME UI FINAL — NO TURN POPUP
// ================================

import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "/shared.js";

let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();

let flipConfirmed = false;
let myTurn = false;

// flip 버튼
const flipAllBtn = document.createElement("button");
flipAllBtn.innerText = "전체 방향 전환";
flipAllBtn.className = "btn-sub small";

const confirmFlipBtn = document.createElement("button");
confirmFlipBtn.innerText = "방향 확정";
confirmFlipBtn.className = "btn-green small";

document
  .querySelector("#myCount")
  .parentElement.appendChild(flipAllBtn);

document
  .querySelector("#myCount")
  .parentElement.appendChild(confirmFlipBtn);


// -------------------------------
// 라운드 시작
// -------------------------------
socket.on("roundStart", ({ round, players: p }) => {
  players = p;
  tableCards = [];

  flipConfirmed = false;  // 새로운 라운드이므로 초기화

  flipAllBtn.style.display = "inline-block";
  confirmFlipBtn.style.display = "inline-block";

  renderPlayers();
  renderTable();
});

// -------------------------------
// 내 패 (단 1개)
// -------------------------------
socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  renderHand();
});

// -------------------------------
// 턴 변경 (팝업 없음!!!)
// -------------------------------
socket.on("turnChange", (uid) => {
  myTurn = uid === myUid;
  highlightTurn(uid);
  // 🔥 여기에는 절대 팝업 X !!!
});

// -------------------------------
// 패 선택 시 only 팝업
// -------------------------------
function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((card, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrapper";

    wrap.appendChild(drawScoutCard(card.top, card.bottom));

    wrap.onclick = () => {
      if (!flipConfirmed) {
        alert("패 방향 확정 후 선택할 수 있습니다!");
        return;
      }

      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);

      renderHand();
    };

    handArea.appendChild(wrap);
  });
}
