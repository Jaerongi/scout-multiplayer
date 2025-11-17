// =======================================
// GAME UI — FINAL FULL VERSION (V3)
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
};

// ========================================================
// SCOUT 버튼 → UI 열기
// ========================================================
scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (!flipConfirmed) return alert("패 방향을 먼저 확정해주세요.");
  if (tableCards.length === 0) return alert("테이블이 비어있습니다.");

  openScoutUI();
};

// ========================================================
// SCOUT UI 생성 함수
// ========================================================
function openScoutUI() {
  // 이미 UI가 있으면 제거
  const oldUI = document.getElementById("scoutUI");
  if (oldUI) oldUI.remove();

  const ui = document.createElement("div");
  ui.id = "scoutUI";
  ui.style.padding = "12px";
  ui.style.background = "#222";
  ui.style.color = "#fff";
  ui.style.marginTop = "10px";
  ui.style.borderRadius = "10px";

  let pickedSide = null;
  let flip = false;
  let insertPos = null;

  ui.innerHTML = `
    <div style="margin-bottom:8px;">SCOUT 옵션 선택</div>

    <button id="btnLeft" class="btn-sub small">왼쪽 가져오기</button>
    <button id="btnRight" class="btn-sub small">오른쪽 가져오기</button>
    <br><br>

    <button id="btnFlip" class="btn-sub small">뒤집기 OFF</button>
    <br><br>

    <div>삽입 위치 선택:</div>
    <div id="insertButtons" style="display:flex; gap:4px; flex-wrap:wrap; margin:6px 0;"></div>

    <button id="btnScoutConfirm" class="btn-green small" style="margin-top:10px;">
      선택 완료
    </button>
  `;

  handArea.appendChild(ui);

  //----------------------------------------------------
  // 왼쪽 / 오른쪽
  //----------------------------------------------------
  document.getElementById("btnLeft").onclick = () => {
    pickedSide = "left";
    highlightSelect("btnLeft", "btnRight");
  };

  document.getElementById("btnRight").onclick = () => {
    pickedSide = "right";
    highlightSelect("btnRight", "btnLeft");
  };

  //----------------------------------------------------
  // 뒤집기 ON/OFF
  //----------------------------------------------------
  document.getElementById("btnFlip").onclick = () => {
    flip = !flip;
    document.getElementById("btnFlip").innerText = flip ? "뒤집기 ON" : "뒤집기 OFF";
  };

  //----------------------------------------------------
  // 삽입 위치 버튼 구성
  //----------------------------------------------------
  createInsertButtons();

  function createInsertButtons() {
    const con = document.getElementById("insertButtons");
    con.innerHTML = "";

    for (let i = 0; i <= myHand.length; i++) {
      const b = document.createElement("button");
      b.innerText = i;
      b.className = "btn-sub tiny";
      b.style.padding = "4px 6px";

      b.onclick = () => {
        insertPos = i;
        [...con.children].forEach(x => x.classList.remove("btn-green"));
        b.classList.add("btn-green");
      };
      con.appendChild(b);
    }
  }

  //----------------------------------------------------
  // 완료 버튼
  //----------------------------------------------------
  document.getElementById("btnScoutConfirm").onclick = () => {
    if (!pickedSide) return alert("왼쪽/오른쪽을 선택하세요.");
    if (insertPos === null) return alert("삽입 위치를 선택하세요.");

    socket.emit("scout", {
      roomId,
      side: pickedSide,
      flip,
      pos: insertPos
    });

    ui.remove(); // UI 제거
  };

  //----------------------------------------------------
  // helper
  //----------------------------------------------------
  function highlightSelect(on, off) {
    document.getElementById(on).classList.add("btn-green");
    document.getElementById(off).classList.remove("btn-green");
  }
}

// ========================================================
// SHOW + SCOUT (미구현)
// ========================================================
showScoutBtn.onclick = () => {
  alert("아직 준비되지 않은 기능입니다!");
};
