// ==============================
// SCOUT UI — 완성본
// ==============================

let socket = null;
let myPermUid = null;

let myHand = [];
let tableCombo = [];
let tableOwner = null;
let turnIndex = 0;
let players = [];

let selectedCards = [];

window.addEventListener("DOMContentLoaded", () => {
  // 소켓 연결
  socket = io();

  setupSocketEvents();
  setupButtons();
});

// ==============================
// 소켓 이벤트
// ==============================
function setupSocketEvents() {
  socket.on("roomUpdate", data => {
    players = data.players;
    tableCombo = data.tableCombo || [];
    tableOwner = data.tableOwner;
    turnIndex = data.turnIndex;

    const me = players.find(p => p.permUid === myPermUid);
    if (me) myHand = me.hand;

    renderPlayers();
    renderTable();
    renderHand();
  });

  socket.on("gameStarted", data => {
    players = data.players;
    tableCombo = data.tableCombo;
    turnIndex = data.turnIndex;

    const me = players.find(p => p.permUid === myPermUid);
    if (me) myHand = me.hand;

    renderPlayers();
    renderTable();
    renderHand();
  });

  socket.on("errorMessage", msg => {
    alert(msg);
  });
}

// ==============================
// 버튼 동작
// ==============================
function setupButtons() {
  document.getElementById("showBtn").onclick = () => {
    if (selectedCards.length === 0) {
      alert("카드를 선택하세요!");
      return;
    }

    socket.emit("showCombo", {
      roomId: window.roomId,
      combo: selectedCards
    });

    selectedCards = [];
    renderHand();
  };

  document.getElementById("scoutBtn").onclick = () => {
    if (!tableCombo || tableCombo.length === 0) {
      alert("스카우트할 카드가 없습니다.");
      return;
    }

    // SCOUT 모드 시작
    startScoutMode();
  };

  document.getElementById("passBtn").onclick = () => {
    socket.emit("pass", window.roomId);
  };

  document.getElementById("ssBtn").onclick = () => {
    // SCOUT + SHOW → 구현하려면 SCOUT 후 SHOW 로직 조합됨
    alert("SCOUT+SHOW는 차후 추가 구현 예정");
  };
}

// ==============================
// 렌더링 — 플레이어
// ==============================
function renderPlayers() {
  const area = document.getElementById("playerList");
  area.innerHTML = "";

  players.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "playerItem";

    const turnMark = (i === turnIndex) ? "▶ " : "";
    div.innerText = `${turnMark}${p.userName} (${p.score}점)`;

    area.appendChild(div);
  });
}

// ==============================
// 렌더링 — 테이블
// ==============================
function renderTable() {
  const area = document.getElementById("tableCards");
  area.innerHTML = "";

  if (!tableCombo) return;

  tableCombo.forEach(c => {
    area.appendChild(makeCardElement(c));
  });
}

// ==============================
// 렌더링 — 내 패
// ==============================
function renderHand() {
  const area = document.getElementById("handArea");
  area.innerHTML = "";

  // SCOUT 모드가 아니라면 삽입 위치 버튼 제거
  if (!window.isScoutMode) {
    selectedCards = [];
  }

  // 삽입 위치 UI
  if (window.isScoutMode) {
    for (let i = 0; i <= myHand.length; i++) {
      const spot = document.createElement("div");
      spot.className = "insertSpot";
      spot.onclick = () => scoutInsert(i);
      area.appendChild(spot);

      if (i < myHand.length) {
        area.appendChild(makeCardElement(myHand[i], i));
      }
    }
  } else {
    myHand.forEach((c, i) => {
      area.appendChild(makeCardElement(c, i));
    });
  }
}

// ==============================
// 카드 DOM 생성
// ==============================
function makeCardElement(card, index = null) {
  const div = document.createElement("div");
  div.className = "card";

  const t = document.createElement("div");
  t.className = "topNum";
  t.innerText = card.direction === "top" ? card.top : card.bottom;

  const b = document.createElement("div");
  b.className = "bottomNum";
  b.innerText = card.direction === "top" ? card.bottom : card.top;

  // 선택 처리
  div.onclick = () => {
    if (window.isScoutMode) return;

    if (div.classList.contains("selected")) {
      div.classList.remove("selected");
      selectedCards = selectedCards.filter(c => c.id !== card.id);
    } else {
      div.classList.add("selected");
      selectedCards.push(card);
    }
  };

  div.appendChild(t);
  div.appendChild(b);
  return div;
}

// ==============================
// SCOUT 모드
// ==============================
function startScoutMode() {
  window.isScoutMode = true;
  renderHand();
}

function scoutInsert(idx) {
  const targetCard = tableCombo[0];
  const direction = "top"; // 기본, UI에서 선택 가능하게 하려면 수정 가능

  socket.emit("scout", {
    roomId: window.roomId,
    card: targetCard,
    direction,
    insertIndex: idx
  });

  window.isScoutMode = false;
  renderHand();
}

document.getElementById("ssBtn").onclick = () => {
  if (!tableCombo || tableCombo.length === 0) {
    alert("테이블 카드가 없습니다.");
    return;
  }

  // SCOUT + SHOW 모드 시작
  window.isSsMode = true;
  startScoutMode(true);  // SCOUT 모드 재사용
};
function scoutInsert(idx) {
  const targetCard = tableCombo[0];
  const direction = "top";

  if (window.isSsMode) {
    // SCOUT 먼저 서버에 전송
    socket.emit("scout", {
      roomId: window.roomId,
      card: targetCard,
      direction,
      insertIndex: idx
    });

    // SCOUT 반영 후 → SHOW 실행
    setTimeout(() => {
      autoShowAfterScout();
    }, 200);

    window.isScoutMode = false;
    window.isSsMode = false;
    renderHand();
    return;
  }

  // 일반 SCOUT
  socket.emit("scout", {
    roomId: window.roomId,
    card: targetCard,
    direction,
    insertIndex: idx
  });

  window.isScoutMode = false;
  renderHand();
}
socket.on("roundEnd", data => {
  const list = document.getElementById("roundResultList");
  list.innerHTML = "";

  data.players.forEach(p => {
    const div = document.createElement("div");
    div.innerText = `${p.userName}: ${p.score}점`;
    list.appendChild(div);
  });

  // 팝업 표시
  document.getElementById("roundEndModal").style.display = "flex";
});

// 다음 라운드
document.getElementById("nextRoundBtn").onclick = () => {
  document.getElementById("roundEndModal").style.display = "none";

  socket.emit("startGame", window.roomId); // 새 라운드
};

