// ========================================================
// shared.js — UMD + ESM 완전 호환 버전 (2025.11 안정판)
// ========================================================

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    // Node.js (CommonJS or ES Module interop)
    module.exports = factory();
  } else {
    // Browser 글로벌
    root.shared = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {

  // ============================
  // SCOUT 조합 체크 함수
  // ============================
  function getComboType(cards) {
    if (!cards || cards.length === 0) return "NONE";
    if (cards.length === 1) return "SINGLE";

    let same = cards.every(x => x.top === cards[0].top);
    if (same) return "STRAIGHT";

    return "NONE";
  }

  function isStrongerCombo(prev, next) {
    if (!prev || prev.length === 0) return true;
    if (!next || next.length === 0) return false;

    if (prev.length !== next.length) return false;

    let prevType = getComboType(prev);
    let nextType = getComboType(next);

    if (prevType !== nextType) return false;

    let pMax = Math.max(...prev.map(x => x.top));
    let nMax = Math.max(...next.map(x => x.top));

    return nMax > pMax;
  }

  // Node.js + Browser 모두 반환
  return {
    getComboType,
    isStrongerCombo
  };
});


// 🔥 ES Module 방식에서도 사용 가능하게 export 추가
export function getComboType(cards) {
  return (typeof window !== "undefined" ? window.shared.getComboType(cards) : getComboType(cards));
}

export function isStrongerCombo(prev, next) {
  return (typeof window !== "undefined" ? window.shared.isStrongerCombo(prev, next) : isStrongerCombo(prev, next));
}
