// ================================
// SCOUT CARD RENDER ENGINE (IMAGE DECK)
// ================================
//
// This project now uses the official 45-card PNG deck under:
//   /public/cards/*.png
//
// File naming convention:
//   {id: 1..45 -> 001..045}_{min}-{max}.png
// Example: 001_1-2.png
//
// If the card is flipped (top > bottom), we reuse the same image and rotate 180deg.
//

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

// (t,b) where t<b => official id 1..45
function pairToId(t, b) {
  // number of pairs with first < t:
  // sum_{k=1..t-1} (10-k) = (t-1)(20-t)/2
  const prev = ((t - 1) * (20 - t)) / 2;
  return prev + (b - t);
}

function getCardFile(top, bottom) {
  const min = Math.min(top, bottom);
  const max = Math.max(top, bottom);
  const id = pairToId(min, max);
  const padded = String(id).padStart(3, "0");
  return `${padded}_${min}-${max}.png`;
}

// ================================
// drawScoutCard (PNG 이미지 버전)
// ================================
export function drawScoutCard(top, bottom) {
  const card = document.createElement("div");
  card.className = "scout-card image-card";
  card.dataset.top = String(top);
  card.dataset.bottom = String(bottom);

  const img = document.createElement("img");
  img.className = "card-img";
  img.alt = `SCOUT ${top}-${bottom}`;
  img.loading = "lazy";
  img.decoding = "async";

  const file = getCardFile(top, bottom);
  img.src = `cards/${file}`;

  // IMPORTANT:
  // Keep the PNG upright at all times.
  // Rotating the whole PNG can make printed corner numbers upside down.
  // Instead, overlay upright number chips so readability stays consistent.
  card.appendChild(img);

  const topChip = document.createElement("div");
  topChip.className = "num-circle num-top";
  topChip.textContent = String(top);

  const bottomChip = document.createElement("div");
  bottomChip.className = "num-circle num-bottom";
  bottomChip.textContent = String(bottom);

  card.appendChild(topChip);
  card.appendChild(bottomChip);
  return card;
}
