// ===================================
// SCOUT SHARED ENGINE v3.5
// (서버/클라이언트 공용 엔진)
// ===================================

/* ---------------------------------------
   🎴 공식 44장 SCOUT 덱
---------------------------------------- */
export const SCOUT_DECK = [
  {top:1,bottom:7},{top:1,bottom:9},{top:1,bottom:5},{top:1,bottom:4},
  {top:2,bottom:6},{top:2,bottom:8},{top:2,bottom:9},{top:2,bottom:5},
  {top:3,bottom:7},{top:3,bottom:6},{top:3,bottom:1},{top:3,bottom:10},
  {top:4,bottom:8},{top:4,bottom:2},{top:4,bottom:10},{top:4,bottom:7},
  {top:5,bottom:9},{top:5,bottom:3},{top:5,bottom:8},{top:5,bottom:1},
  {top:6,bottom:4},{top:6,bottom:1},{top:6,bottom:10},{top:6,bottom:3},
  {top:7,bottom:2},{top:7,bottom:9},{top:7,bottom:5},{top:7,bottom:4},
  {top:8,bottom:3},{top:8,bottom:6},{top:8,bottom:2},{top:8,bottom:10},
  {top:9,bottom:5},{top:9,bottom:7},{top:9,bottom:4},{top:9,bottom:1},
  {top:10,bottom:8},{top:10,bottom:6},{top:10,bottom:3},{top:10,bottom:2},
  {top:1,bottom:3},{top:2,bottom:4},{top:5,bottom:7},{top:8,bottom:9},
];

/* ---------------------------------------
   🔀 Fisher–Yates Shuffle
---------------------------------------- */
export function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------------------------------------
   🃏 Multiplayer Deal (11장 × N)
---------------------------------------- */
export function dealForMultiplayer(playerCount) {
  let deck = shuffle(SCOUT_DECK);
  const hands = [];

  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.slice(i*11, i*11 + 11));
  }

  deck = deck.slice(playerCount * 11);
  return { hands, deck };
}

/* ---------------------------------------
   ↔ 카드 뒤집기 지원
---------------------------------------- */
export function applyFlip(card, flipped) {
  return flipped
    ? { top: card.bottom, bottom: card.top }
    : { top: card.top, bottom: card.bottom };
}

/* ---------------------------------------
   🎯 값만 추출(top 기준)
---------------------------------------- */
export function getValues(cards) {
  return cards.map(c => c.top);
}

/* ---------------------------------------
   🟦 SET 판정
---------------------------------------- */
export function isSet(cards) {
  const v = getValues(cards);
  return v.every(n => n === v[0]);
}

/* ---------------------------------------
   🟩 RUN 판정
---------------------------------------- */
export function isRun(cards) {
  let arr = getValues(cards).sort((a,b)=>a-b);
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== arr[i-1] + 1) return false;
  }
  return true;
}

// ==========================
// SCOUT COMBO SYSTEM
// ==========================

export function getComboType(cards) {
  if (!cards || cards.length === 0) return "invalid";

  const tops = cards.map(c => c.top).sort((a, b) => a - b);

  // SET (모두 동일 숫자)
  if (tops.every(v => v === tops[0])) return "set";

  // RUN (연속 숫자)
  let run = true;
  for (let i = 1; i < tops.length; i++) {
    if (tops[i] !== tops[i - 1] + 1) {
      run = false;
      break;
    }
  }
  if (run) return "run";

  return "invalid";
}

// ==========================
// STRENGTH RANK
// ==========================
// set = 2점, run = 1점
function comboStrength(type) {
  return type === "set" ? 2 : type === "run" ? 1 : 0;
}

// ==========================
// Compare function
// ==========================
export function isStrongerCombo(newCards, oldCards) {
  // 1) 테이블 비었으면 무조건 가능
  if (!oldCards || oldCards.length === 0) return true;

  const newType = getComboType(newCards);
  const oldType = getComboType(oldCards);

  // invalid combo
  if (newType === "invalid") return false;
  if (oldType === "invalid") return true;

  const newLen = newCards.length;
  const oldLen = oldCards.length;

  // 2) 장수 비교 — 장수가 많으면 무조건 승리
  if (newLen > oldLen) return true;
  if (newLen < oldLen) return false;

  // 3) 종류 비교 — Set > Run
  const newPower = comboStrength(newType);
  const oldPower = comboStrength(oldType);

  if (newPower > oldPower) return true;
  if (newPower < oldPower) return false;

  // 4) 숫자 비교 — 가장 큰 숫자로 비교
  const maxNew = Math.max(...newCards.map(c => c.top));
  const maxOld = Math.max(...oldCards.map(c => c.top));

  return maxNew > maxOld;
}


/* ---------------------------------------
   🧮 점수 계산
---------------------------------------- */
export function calculateRoundScore(player) {
  return -player.handCount + player.coins;
}

export function applyRoundScores(players) {
  Object.values(players).forEach(p => {
    p.score += calculateRoundScore(p);
  });

  return players;
}

