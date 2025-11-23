// ===================================
// SCOUT SHARED ENGINE v3.6
// ===================================

// 공식 45장 덱 생성
export function createOfficialDeck() {
  const deck = [];
  for (let t = 1; t <= 9; t++) {
    for (let b = t + 1; b <= 10; b++) {
      deck.push({ top: t, bottom: b });
    }
  }
  return deck; // 45장
}

// 카드 숫자 추출 (top 기준)
export function getValues(cards) {
  return cards.map(c => c.top);
}

// RUN 판정
export function isRun(cards) {
  const v = getValues(cards).sort((a, b) => a - b);
  for (let i = 1; i < v.length; i++) {
    if (v[i] !== v[i - 1] + 1) return false;
  }
  return true;
}

// SET 판정
export function isSet(cards) {
  const v = getValues(cards);
  return v.every(n => n === v[0]);
}

// 조합 타입
export function getComboType(cards) {
  if (cards.length === 0) return "invalid";
  if (isSet(cards)) return "set";
  if (isRun(cards)) return "run";
  return "invalid";
}

// 조합 비교 규칙
export function isStrongerCombo(newC, oldC) {
  if (oldC.length === 0) return true;

  // 1) 장수 우선
  if (newC.length !== oldC.length)
    return newC.length > oldC.length;

  const newType = getComboType(newC);
  const oldType = getComboType(oldC);

  // 2) SET > RUN
  if (newType !== oldType)
    return newType === "set";

  // 3) 숫자 큰쪽이 승리
  const newMax = Math.max(...newC.map(c => c.top));
  const oldMax = Math.max(...oldC.map(c => c.top));

  return newMax > oldMax;
}
