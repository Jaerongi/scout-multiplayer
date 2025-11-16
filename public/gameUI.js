// gameUI.js
import { drawScoutCard } from "./cardEngine.js";
import { getComboType, isStrongerCombo } from "./shared.js";

const gamePlayerList = document.getElementById("gamePlayerList");
const tableArea = document.getElementById("tableArea");
const handArea = document.getElementById("handArea");
const myCountSpan = document.getElementById("myCount");

const showBtn = document.getElementById("showBtn");
const scoutBtn = document.getElementById("scoutBtn");

let players = {};
let tableCards = [];
let myHand = [];
let selected = new Set();
let flipState = {};
let myTurn = false;

window.socket.on("playerListUpdate", (p) => {
  players = p;
  renderPlayerList();
});

window.socket.on("roundStart", ({ players: p, startingPlayer }) => {
  players = p;
  tableCards = [];
  renderPlayerList();
  renderTable();
  myTurn = startingPlayer === window.myUid;
  highlightTurn(startingPlayer);
});

window.socket.on("yourHand", (hand) => {
  myHand = hand;
  selected.clear();
  flipState = {};
  renderHand();
});

window.socket.on("handCountUpdate", (data) => {
  for (let uid in data) {
    players[uid].handCount = data[uid];
  }
  renderPlayerList();
});

window.socket.on("tableUpdate", (cards) => {
  tableCards = cards;
  renderTable();
});

window.socket.on("turnChange", (uid) => {
  myTurn = uid === window.myUid;
  highlightTurn(uid);
});

function renderPlayerList() {
  gamePlayerList.innerHTML = "";

  Object.values(players).forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerBox";
    if (p.uid === window.myUid) div.classList.add("me");

    div.innerHTML = `
      <div class="pname">${p.nickname}</div>
      <div class="pinfo">패:${p.handCount} | 점수:${p.score}</div>
    `;

    gamePlayerList.appendChild(div);
  });
}

function highlightTurn(uid) {
  const boxes = gamePlayerList.getElementsByClassName("playerBox");
  const plist = Object.values(players);

  for (let i = 0; i < plist.length; i++) {
    boxes[i].classList.toggle("turn", plist[i].uid === uid);
  }
}

function renderTable() {
  tableArea.innerHTML = "";

  if (tableCards.length === 0) {
    tableArea.innerHTML = `<div class="empty">(비어 있음)</div>`;
    return;
  }

  tableCards.forEach((c) => {
    tableArea.appendChild(drawScoutCard(c.top, c.bottom, 70, 100));
  });
}

function renderHand() {
  handArea.innerHTML = "";
  myCountSpan.innerText = myHand.length;

  myHand.forEach((card, idx) => {
    const flipped = flipState[idx] === "bottom";
    const realCard = flipped
      ? { top: card.bottom, bottom: card.top }
      : card;

    const wrap = document.createElement("div");
    wrap.className = "cardWrap";
    if (selected.has(idx)) wrap.classList.add("sel");

    wrap.appendChild(drawScoutCard(realCard.top, realCard.bottom, 60, 90));

    const flipBtn = document.createElement("div");
    flipBtn.className = "flipBtn";
    flipBtn.innerText = "↺";
    flipBtn.onclick = (e) => {
      e.stopPropagation();
      flipState[idx] = flipped ? "top" : "bottom";
      renderHand();
    };
    wrap.appendChild(flipBtn);

    wrap.onclick = () => {
      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);
      renderHand();
    };

    handArea.appendChild(wrap);
  });
}

showBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (selected.size === 0) return alert("카드를 선택하세요.");

  const cards = [...selected].map((i) => {
    const c = myHand[i];
    return flipState[i] === "bottom"
      ? { top: c.bottom, bottom: c.top }
      : c;
  });

  if (getComboType(cards) === "invalid")
    return alert("세트/런이 아닙니다.");

  if (!isStrongerCombo(cards, tableCards))
    return alert("기존 테이블보다 약합니다.");

  window.socket.emit("show", { roomId: window.roomId, cards });
  selected.clear();
  flipState = {};
};

scoutBtn.onclick = () => {
  if (!myTurn) return alert("당신의 턴이 아닙니다.");
  if (tableCards.length !== 1)
    return alert("스카우트는 테이블에 1장일 때만 가능합니다.");

  const t = tableCards[0];
  const chooseBottom = confirm(
    `스카우트 방향 선택:
확인 → bottom(${t.bottom})
취소 → top(${t.top})`
  );
  const chosen = chooseBottom ? "bottom" : "top";

  window.socket.emit("scout", { roomId: window.roomId, chosenValue: chosen });
  selected.clear();
};
