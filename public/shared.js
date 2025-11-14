// ===============================================
// SCOUT – 공통 모듈 (족보/조합 비교)
// ===============================================

// 패의 숫자 색상 구분용
export const COLOR_MAP = {
  1: "#f44336",
  2: "#e91e63",
  3: "#9c27b0",
  4: "#673ab7",
  5: "#3f51b5",
  6: "#2196f3",
  7: "#009688",
  8: "#4caf50",
  9: "#cddc39",
  10: "#ff9800"
};

// -------------------------------
// SET: 모든 top 숫자가 동일
// -------------------------------
export function isSet(cards) {
  const v = cards.map(c => c.top);
  return v.every(n => n === v[0]);
}

// -------------------------------
// RUN: top 숫자가 연속
// -------------------------------
export function isRun(cards) {
  const arr = cards.map(c => c.top).sort((a,b)=>a-b);
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== arr[i-1] + 1) return false;
  }
  return true;
}

// -------------------------------
// 조합 타입
// -------------------------------
export function getComboType(cards) {
  if (isSet(cards)) return "set";
  if (isRun(cards)) return "run";
  return "invalid";
}

// -------------------------------
// 조합 비교 (강한가?)
// ① 장수 > ② 종류(Set > Run) > ③ 숫자
// -------------------------------
export function isStrongerCombo(newCards, oldCards) {

  // 기존 없으면 무조건 가능
  if (!oldCards || oldCards.length === 0) return true;

  // 장수 우선
  if (newCards.length !== oldCards.length) {
    return newCards.length > oldCards.length;
  }

  const typeNew = getComboType(newCards);
  const typeOld = getComboType(oldCards);

  // SET > RUN
  const typeRank = { set: 2, run: 1 };

  if (typeRank[typeNew] !== typeRank[typeOld]) {
    return typeRank[typeNew] > typeRank[typeOld];
  }

  // 숫자 비교 → 가장 큰 top 숫자 비교
  const maxNew = Math.max(...newCards.map(c => c.top));
  const maxOld = Math.max(...oldCards.map(c => c.top));

  return maxNew > maxOld;
}
