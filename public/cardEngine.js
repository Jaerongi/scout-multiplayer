// ================================
// SCOUT CARD DRAW ENGINE
// ================================

export const COLOR_MAP = {
  1: "#5c6ae6",
  2: "#3b4df5",
  3: "#74c1e8",
  4: "#31b3bd",
  5: "#31bd7c",
  6: "#7be39c",
  7: "#edf342",
  8: "#c7cc35",
  9: "#f2c913",
  10: "#fa2e23",
};

// ================================
// drawScoutCard (canvas 기반 카드 렌더링)
// ================================
export function drawScoutCard(top, bottom) {
  const card = document.createElement("div");
  card.className = "scout-card";

  const topNum = document.createElement("div");
  topNum.className = "num-circle num-top";
  topNum.innerText = top;

  const botNum = document.createElement("div");
  botNum.className = "num-circle num-bottom";
  botNum.innerText = bottom;

  card.appendChild(topNum);
  card.appendChild(botNum);

  const colors = [
    ["#3DB2FF", "#00DFA2"],
    ["#FF6D28", "#FFD93D"],
    ["#6A5ACD", "#48C9B0"],
    ["#FF6363", "#FFA36C"],
    ["#4CD137", "#9AECDB"],
  ];

  const pick = colors[Math.floor(Math.random() * colors.length)];
  card.style.setProperty("--left-color", pick[0]);
  card.style.setProperty("--right-color", pick[1]);

  return card;
}

