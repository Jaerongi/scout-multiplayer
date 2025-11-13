// shared.js
// 모든 공통 게임 로직을 담은 파일
// 서버와 클라이언트에서 동일하게 사용됨

/* -----------------------------
   🎴 44장 SCOUT 공식 덱
------------------------------*/
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

/* -----------------------------
   🔀 셔플 (Fisher–Yates)
------------------------------*/
export function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ----------------------------------------
   🃏 멀티플레이 배분 (플레이어당 11장)
-----------------------------------------*/
export function dealForMultiplayer(playerCount) {
  let deck = shuffle(SCOUT_DECK);
  const hands = [];

  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.slice(i*11, i*11 + 11));
  }

  deck = deck.slice(playerCount * 11);

  return { hands, deck };
}

/* -----------------------------
   🎯 세트/런 판정 보조
------------------------------*/
function getValues(cards) {
  // top 숫자 기준으로 판단
  return cards.map(c => c.top);
}

/* -----------------------------
   🟦 SET 판정: 모두 같은 숫자
------------------------------*/
export function isSet(cards) {
  const v = getValues(cards);
  return v.every(x => x === v[0]);
}

/* -----------------------------
   🟩 RUN 판정: 연속 숫자
------------------------------*/
export function isRun(cards) {
  let arr = getValues(cards).sort((a,b)=>a-b);

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== arr[i-1] + 1) return false;
  }
  return true;
}

/* -----------------------------
   🧩 조합 타입 반환
------------------------------*/
export function getComboType(cards) {
  if (cards.length === 0) return "invalid";
  if (isSet(cards)) return "set";
  if (isRun(cards)) return "run";
  return "invalid";
}

/* -----------------------------
   ⚔ 조합 비교 (테이블보다 강한가?)
------------------------------*/
export function isStrongerCombo(newCards, oldCards) {
  if (oldCards.length === 0) return true;  // 테이블이 비었으면 무조건 OK

  const typeNew = getComboType(newCards);
  const typeOld = getComboType(oldCards);

  if (typeNew !== typeOld) return false;
  if (newCards.length !== oldCards.length) return false;

  // set 비교 → 숫자가 더 큰지
  if (typeNew === "set") {
    return newCards[0].top > oldCards[0].top;
  }

  // run 비교 → 마지막 숫자 비교
  if (typeNew === "run") {
    const maxNew = Math.max(...newCards.map(c => c.top));
    const maxOld = Math.max(...oldCards.map(c => c.top));
    return maxNew > maxOld;
  }

  return false;
}
