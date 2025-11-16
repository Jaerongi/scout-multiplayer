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

// =========================================
// SHARED — SCOUT GAME LOGIC (SET / RUN 판정)
// =========================================

// 숫자 목록 반환
export function getValues(cards) {
  return cards.map(c => c.top);
}

// ========= RUN 판정 (연속 숫자)
export function isRun(cards) {
  const v = getValues(cards).sort((a, b) => a - b);
  for (let i = 1; i < v.length; i++) {
    if (v[i] !== v[i - 1] + 1) return false;
  }
  return true;
}

// ========= SET 판정 (모두 동일 숫자)
export function isSet(cards) {
  const v = getValues(cards);
  return v.every(n => n === v[0]);
}

// ========= 조합 종류
export function getComboType(cards) {
  if (cards.length === 0) return "invalid";
  if (isSet(cards)) return "set";
  if (isRun(cards)) return "run";
  return "invalid";
}

// ========= 조합 비교 규칙
// 1) 장수가 많을수록 강함
// 2) 동일 숫자(set) > run
// 3) 숫자가 클수록 강함
export function isStrongerCombo(newC, oldC) {
  if (oldC.length === 0) return true; // 테이블 비었으면 OK

  // 1. 장수 비교
  if (newC.length !== oldC.length) {
    return newC.length > oldC.length;
  }

  const newType = getComboType(newC);
  const oldType = getComboType(oldC);

  // 2. set 우선
  if (newType !== oldType) {
    return newType === "set";
  }

  // 3. 숫자 비교
  const newMax = Math.max(...newC.map(c => c.top));
  const oldMax = Math.max(...oldC.map(c => c.top));

  return newMax > oldMax;
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


