// =====================================================
// SHARED.JS — ES Module + Browser Global 동시 지원
// =====================================================

// ----------- ESM EXPORT (서버 / Node.js 용) ----------------
export function compareNumbers(a, b) {
  return a - b;
}

export function getComboType(cards) {
  if (!cards || cards.length === 0) return "invalid";
  if (cards.length === 1) return "single";

  const tops = cards.map(c => c.top);

  // SET
  const allSame = tops.every(t => t === tops[0]);
  if (allSame) return "set";

  // STRAIGHT
  const sorted = [...tops].sort(compareNumbers);
  const isStraight = sorted.every((v, i) =>
    i === 0 ? true : v === sorted[i - 1] + 1
  );
  if (isStraight) return "straight";

  return "invalid";
}

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

// ----------- BROWSER GLOBAL 등록 ----------------
if (typeof window !== "undefined") {
  window.shared = {
    compareNumbers,
    getComboType,
    isStrongerCombo
  };
  console.log("shared.js: Browser Global Ready");
}
