// shared.js
export const COLOR_MAP = {
  1: "#5c6ae6",
  2: "#3b4df5",
  3: "#74c1e8",
  4: "#31b3bd",
  5: "#31bd7c",
  6: "#7be39c",
  7: "#f2fa0a",
  8: "#c7cc35",
  9: "#f2c913",
  10: "#fa2e23",
};

function values(cards) {
  return cards.map((c) => c.top);
}

export function isSet(cards) {
  if (cards.length <= 1) return false;
  return values(cards).every((v) => v === values(cards)[0]);
}

export function isRun(cards) {
  if (cards.length <= 1) return false;
  const arr = values(cards).sort((a, b) => a - b);
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== arr[i - 1] + 1) return false;
  }
  return true;
}

export function getComboType(cards) {
  if (isSet(cards)) return "set";
  if (isRun(cards)) return "run";
  return "invalid";
}

/**
 * 스카우트 기본 족보 비교
 * 1) 장수가 많을수록 강함
 * 2) SET > RUN
 * 3) 숫자가 클수록 강함
 */
export function isStrongerCombo(newCards, oldCards) {
  if (oldCards.length === 0) return true;

  if (newCards.length !== oldCards.length) {
    return newCards.length > oldCards.length;
  }

  const tNew = getComboType(newCards);
  const tOld = getComboType(oldCards);

  const rank = { set: 2, run: 1, invalid: 0 };
  if (rank[tNew] !== rank[tOld]) return rank[tNew] > rank[tOld];

  const maxNew = Math.max(...values(newCards));
  const maxOld = Math.max(...values(oldCards));
  return maxNew > maxOld;
}
