// =====================================================
// shared.js — GLOBAL UTILITIES (전역 함수 버전)
// =====================================================

// 전역 등록을 위해 window가 존재하는지 확인
const G = (typeof window !== "undefined") ? window : global;

// =====================================================
// 숫자 비교용 헬퍼
// =====================================================
G.compareNumbers = function (a, b) {
  return a - b;
};

// =====================================================
// 조합 타입 판정
// =====================================================
// 반환값
// "single"  : 1장
// "straight": 연속 숫자 (최소 2장)
// "set"     : 같은 숫자 (최소 2장)
// "invalid" : 불가능한 조합
// =====================================================
G.getComboType = function (cards) {
  if (!cards || cards.length === 0) return "invalid";
  if (cards.length === 1) return "single";

  const tops = cards.map(c => c.top);
  const bottoms = cards.map(c => c.bottom);

  // SET: top 숫자가 모두 동일
  const allSame = tops.every(t => t === tops[0]);
  if (allSame) return "set";

  // STRAIGHT: top 기준으로 1씩 증가
  const sorted = [...tops].sort((a, b) => a - b);
  let straight = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      straight = false;
      break;
    }
  }
  if (straight) return "straight";

  return "invalid";
};


// =====================================================
// 조합 비교 (a가 b보다 강한가?)
// =====================================================
// cardsA vs cardsB
// 조건:
// - 같은 타입이어야 비교 가능
// - 같은 개수여야 비교 가능
// - set → 높은 숫자 비교
// - straight → 마지막 숫자 비교
// - single → 숫자 비교
// =====================================================
G.isStrongerCombo = function (myCards, tableCards) {
  if (!tableCards || tableCards.length === 0) return true; // 첫 제출

  const myType = G.getComboType(myCards);
  const tableType = G.getComboType(tableCards);

  if (myType === "invalid") return false;
  if (myType !== tableType) return false;
  if (myCards.length !== tableCards.length) return false;

  if (myType === "single") {
    return myCards[0].top > tableCards[0].top;
  }

  if (myType === "set") {
    return myCards[0].top > tableCards[0].top;
  }

  if (myType === "straight") {
    const mySorted = [...myCards.map(c => c.top)].sort(G.compareNumbers);
    const tableSorted = [...tableCards.map(c => c.top)].sort(G.compareNumbers);
    return mySorted[mySorted.length - 1] > tableSorted[tableSorted.length - 1];
  }

  return false;
};

console.log("shared.js loaded (GLOBAL VERSION)");
