// =====================================================
// SHARED.JS — Node + Browser 공통 ES Module
// =====================================================

// 숫자 정렬 헬퍼
export function compareNumbers(a, b) {
  return a - b;
}

// =====================================================
// 조합 타입 판정
// =====================================================
// 반환값
// "single"  : 1장
// "straight": 연속 숫자
// "set"     : 같은 숫자
// "invalid" : 불가능
// =====================================================
export function getComboType(cards) {
  if (!cards || cards.length === 0) return "invalid";
  if (cards.length === 1) return "single";

  const tops = cards.map(c => c.top);

  // SET
  const allSame = tops.every(t => t === tops[0]);
  if (allSame) return "set";

  // STRAIGHT
  const sorted = [...tops].sort((a, b) => a - b);
  const isStraight = sorted.every(
    (v, i) => i === 0 || v === sorted[i - 1] + 1
  );
  if (isStraight) return "straight";

  return "invalid";
}

// =====================================================
// 조합 세기 비교
// =====================================================
export function isStrongerCombo(myCards, tableCards) {
  if (!tableCards || tableCards.length === 0) return true;

  const myType = getComboType(myCards);
  const tableType = getComboType(tableCards);

  if (myType === "invalid") return false;
  if (myType !== tableType) return false;
  if (myCards.length !== tableCards.length) return false;

  if (myType === "single" || myType === "set") {
    return myCards[0].top > tableCards[0].top;
  }

  if (myType === "straight") {
    const mySorted = myCards.map(c => c.top).sort(compareNumbers);
    const tableSorted = tableCards.map(c => c.top).sort(compareNumbers);
    return mySorted.at(-1) > tableSorted.at(-1);
  }

  return false;
}

console.log("shared.js (ESM) loaded");
