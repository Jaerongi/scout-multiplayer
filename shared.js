(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    // Node.js(CommonJS / ESM)
    module.exports = factory();
  } else {
    // Browser
    root.shared = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {

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

    let prevMax = Math.max(...prev.map(x => x.top));
    let nextMax = Math.max(...next.map(x => x.top));

    return nextMax > prevMax;
  }

  return {
    getComboType,
    isStrongerCombo
  };
});
