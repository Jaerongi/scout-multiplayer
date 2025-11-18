// =====================================================
// GAME UI (import 제거 + 전역 등록)
// =====================================================

function renderHand(hand) {
  const area = document.getElementById("handArea");
  if (!area) return;

  area.innerHTML = "";
  hand.forEach(c => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerText = `${c.top}/${c.bottom}`;
    area.appendChild(div);
  });
}

function renderTable(cards) {
  const area = document.getElementById("tableArea");
  if (!area) return;

  area.innerHTML = "";
  cards.forEach(c => {
    const div = document.createElement("div");
    div.className = "card table-card";
    div.innerText = `${c.top}/${c.bottom}`;
    area.appendChild(div);
  });
}

function updateTurnHighlight(uid) {
  const info = document.getElementById("turnInfo");
  if (info && window.players && window.players[uid]) {
    info.innerText = `현재 턴: ${window.players[uid].nickname}`;
  }
}

function startRoundUI(data) {
  const roundInfo = document.getElementById("roundInfo");
  if (roundInfo) roundInfo.innerText = `Round ${data.round}`;
}

function showRoundWinner(data) {
  const pop = document.getElementById("popupArea");
  pop.innerHTML = `<div class="popup">라운드 승자: ${window.players[data.winner].nickname}</div>`;
}

function showFinalWinner(data) {
  const pop = document.getElementById("popupArea");
  pop.innerHTML = `<div class="popup final">최종 우승: ${window.players[data.winner].nickname}</div>`;
}

function restoreGameUI(data) {
  renderHand(data.hand);
  renderTable(data.table);
  startRoundUI(data);
  updateTurnHighlight(data.turn);
}

// 전역 등록
window.renderHand = renderHand;
window.renderTable = renderTable;
window.updateTurnHighlight = updateTurnHighlight;
window.startRoundUI = startRoundUI;
window.showRoundWinner = showRoundWinner;
window.showFinalWinner = showFinalWinner;
window.restoreGameUI = restoreGameUI;
