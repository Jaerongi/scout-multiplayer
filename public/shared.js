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

/* ---------------------------------------
   🧩 조합 타입 반환
---------------------------------------- */
export function getComboType(cards) {
  if (!cards || cards.length === 0) return "invalid";
  if (cards.length === 1) return "single";
  if (isSet(cards)) return "set";
  if (isRun(cards)) return "run";
  return "invalid";
}

/* ---------------------------------------
   ⚔ 조합 비교 (테이블보다 강한가?)
---------------------------------------- */
export function isStrongerCombo(newCards, oldCards) {
  if (oldCards.length === 0) return true;

  const typeNew = getComboType(newCards);
  const typeOld = getComboType(oldCards);

  if (typeNew !== typeOld) return false;
  if (newCards.length !== oldCards.length) return false;

  // SET: 숫자가 커야 함
  if (typeNew === "set") {
    return newCards[0].top > oldCards[0].top;
  }

  // RUN: 마지막 숫자 비교
  if (typeNew === "run") {
    const maxNew = Math.max(...newCards.map(c => c.top));
    const maxOld = Math.max(...oldCards.map(c => c.top));
    return maxNew > maxOld;
  }

  // SINGLE
  if (typeNew === "single") {
    return newCards[0].top > oldCards[0].top;
  }

  return false;
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
