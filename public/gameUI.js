// ==============================
// SCOUT UI — 완성본 (socket 통합)
// ==============================

let socket = null;

let myPermUid = null;
let myHand = [];
let tableCombo = [];
let tableOwner = null;
let turnIndex = 0;
let players = [];
let selectedCards = [];

let isScoutMode = false;
let isSsMode = false;

window.addEventListener("DOMContentLoaded", () => {
  // socket.js에서 생성한 전역 socket 사용
  socket = window.socket;
  myPermUid = window.myPermUid;

  setupSocketEvents();
  setupButtons();
});

// ==============================
// 소켓 이벤트
// ==============================
function setupSocketEvents() {

  // 게임방 상태 업데이트
  socket.on("roomUpdate", data => {
    players = data.players;
    tableCombo = data.tableCombo || [];
    tableOwner = data.tableOwner;
    turnIndex = data.turnIndex;

    // ⭐ 핵심: myPermUid가 아직 안 세팅된 상황이면 렌더링하지 않음
    if (!myPermUid) return;

    const me = players.find(p => p.permUid === myPermUid);
    if (me) myHand = me.hand;

    renderPlayers();
    renderTable();
    renderHand();
  });

  // 게임 시작
  socket.on("gameStarted", data => {
    players = data.players;
    tableCombo = data.tableCombo || [];
    turnIndex = data.turnIndex;

    // ⭐ myPermUid 준비 안된 경우 무시
    if (!myPermUid) return;

    const me = players.find(p => p.permUid === myPermUid);
    if (me) myHand = me.hand;

    renderPlayers();
    renderTable();
    renderHand();
  });

  // 라운드 종료
  socket.on("roundEnd", data => {
    const list = document.getElementById("roundResultList");
    list.innerHTML = "";

    data.players.forEach(p => {
      const div = document.createElement("div");
      div.innerText = `${p.userName}: ${p.score}점`;
      list.appendChild(div);
    });

    document.getElementById("roundEndModal").style.display = "flex";
  });

  socket.on("errorMessage", msg => {
    alert(msg);
  });
}

// ==============================
// 버튼 동작
// ==============================
function setupButtons() {

  // ⭐ 게임 시작 버튼 (필수)
  document.getElementById("startGameBtn").onclick = () => {
    socket.emit("startGame", window.roomId);
  };

  // SHOW
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

  // SCOUT
  document.getElementById("scoutBtn").onclick = () => {
    if (!tableCombo || tableCombo.length === 0) {
      alert("스카우트할 카드가 없습니다.");
      return;
    }

    isScoutMode = true;
    isSsMode = false;
    renderHand();
  };

  // PASS
  document.getElementById("passBtn").onclick = () => {
    socket.emit("pass", window.roomId);
  };

  // SCOUT & SHOW
  document.getElementById("ssBtn").onclick = () => {
    if (!tableCombo || tableCombo.length === 0) {
      alert("스카우트할 카드가 없습니다.");
      return;
    }

    isScoutMode = true;
    isSsMode = true;
    renderHand();
  };

  // 라운드 종료 후 다음 라운드
  document.getElementById("nextRoundBtn").onclick = () => {
    document.getElementById("roundEndModal").style.display = "none";
    socket.emit("startGame", window.roomId);
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
    const name = p.userName || `Player-${p.permUid.slice(-4)}`;

    div.innerText = `${turnMark}${name} (${p.score}점)`;

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

  if (isScoutMode) {
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

  div.appendChild(t);
  div.appendChild(b);

  // 선택
  div.onclick = () => {
    if (isScoutMode) return;

    if (div.classList.contains("selected")) {
      div.classList.remove("selected");
      selectedCards = selectedCards.filter(c => c.id !== card.id);
    } else {
      div.classList.add("selected");
      selectedCards.push(card);
    }
  };

  // 드래그 (시각 효과)
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  div.onmousedown = e => {
    dragging = true;
    div.classList.add("dragging");

    offsetX = e.offsetX;
    offsetY = e.offsetY;
    document.body.appendChild(div);
  };

  window.onmousemove = e => {
    if (!dragging) return;
    div.style.left = `${e.pageX - offsetX}px`;
    div.style.top = `${e.pageY - offsetY}px`;
  };

  window.onmouseup = () => {
    if (!dragging) return;
    dragging = false;
    div.classList.remove("dragging");
  };

  return div;
}

// ==============================
// SCOUT or SCOUT+SHOW
// ==============================
function scoutInsert(idx) {
  const targetCard = tableCombo[0];
  const direction = "top";

  // SCOUT + SHOW
  if (isSsMode) {
    socket.emit("scout", {
      roomId: window.roomId,
      card: targetCard,
      direction,
      insertIndex: idx
    });

    setTimeout(() => autoShowAfterScout(), 200);

    isScoutMode = false;
    isSsMode = false;
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

  isScoutMode = false;
  renderHand();
}

// ==============================
// SCOUT 후 자동 SHOW
// ==============================
function autoShowAfterScout() {
  const me = players.find(p => p.permUid === myPermUid);
  if (!me) return;

  myHand = me.hand;

  const combos = generateBasicCombos(myHand);
  if (combos.length === 0) {
    alert("SHOW 가능한 콤보가 없습니다.");
    return;
  }

  combos.sort((a, b) => b.power - a.power);
  const best = combos[0];

  socket.emit("showCombo", {
    roomId: window.roomId,
    combo: best.cards
  });
}

// 기본 싱글 콤보만 생성
function generateBasicCombos(hand) {
  return hand.map(c => ({
    cards: [c],
    power: c.value || c.top
  }));
}
