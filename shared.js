// ========================================================
// shared.js — 클라이언트 전용 카드 조합 판단 라이브러리
// (SET / RUN / COMBO 비교 최적화)
// ========================================================

// --------------------------------------------------------
// 조합 타입 판별
//  - "invalid": 조합 불가능
//  - "single": 단일 카드
//  - "set": SET (위/아래 숫자 동일)
//  - "run": RUN (숫자 연속)
// --------------------------------------------------------
export function getComboType(cards) {
  if (!cards || cards.length === 0) return "invalid";
  if (cards.length === 1) return "single";

  // top/bottom 쌍을 문자열로 비교하기 쉽게 변환
  const values = cards.map(c => `${c.top}${c.bottom}`);

  // -----------------------------------------------------
  // SET 판정: top 숫자 전부 동일 or bottom 숫자 전부 동일
  // -----------------------------------------------------
  const allTopSame = cards.every(c => c.top === cards[0].top);
  const allBottomSame = cards.every(c => c.bottom === cards[0].bottom);

  if (allTopSame || allBottomSame) {
    return "set";
  }

  // -----------------------------------------------------
  // RUN 판정: top와 bottom 각각 정렬 후 연속인지 검사
  // -----------------------------------------------------
  const tops = cards.map(c => c.top).sort((a,b)=>a-b);
  const bottoms = cards.map(c => c.bottom).sort((a,b)=>a-b);

  const isTopRun = tops.every((v,i,arr)=> i===0 || arr[i]-arr[i-1] === 1);
  const isBottomRun = bottoms.every((v,i,arr)=> i===0 || arr[i]-arr[i-1] === 1);

  if (isTopRun && isBottomRun) {
    return "run";
  }

  return "invalid";
}


// ========================================================
// 조합 비교 함수
// --------------------------------------------------------
// 규칙:
//   1) 종류 우선순위: run > set > single
//   2) 같은 조합이면 카드 개수가 많은 것이 더 강함
//   3) 같은 개수라면 최소 top 합 또는 bottom 합 기준 비교
// ========================================================

function comboRank(type) {
  if (type === "single") return 1;
  if (type === "set") return 2;
  if (type === "run") return 3;
  return 0;
}

export function isStrongerCombo(newCards, tableCards) {
  if (!tableCards || tableCards.length === 0) return true;

  const typeA = getComboType(newCards);
  const typeB = getComboType(tableCards);

  // 조합 불가면 무효
  if (typeA === "invalid") return false;

  // 조합 등급 비교
  if (typeA !== typeB) {
    return comboRank(typeA) > comboRank(typeB);
  }

  // 카드 수 비교
  if (newCards.length !== tableCards.length) {
    return newCards.length > tableCards.length;
  }

  // 같은 크기 + 같은 조합 → 점수 비교
  const newPower =
    newCards.reduce((sum, c) => sum + c.top + c.bottom, 0);

  const oldPower =
    tableCards.reduce((sum, c) => sum + c.top + c.bottom, 0);

  return newPower > oldPower;
}
