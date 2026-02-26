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


function hexToRgb(hex) {
  const h = (hex || "").replace("#", "").trim();
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function luminance({ r, g, b }) {
  // sRGB relative luminance (approx)
  const srgb = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function applyChipStyle(el, num){
  const color = COLOR_MAP[num] || "#111827";
  const rgb = hexToRgb(color);
  const glow = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)` : "rgba(0,0,0,0.45)";
  const border = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.95)` : "rgba(255,255,255,0.22)";
  const fg = rgb && luminance(rgb) > 0.62 ? "#0b1020" : "#ffffff";

  el.style.setProperty("--chip-bg", color);
  el.style.setProperty("--chip-glow", glow);
  el.style.setProperty("--chip-border", border);
  el.style.setProperty("--chip-fg", fg);
}


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
  applyChipStyle(topChip, top);

  const bottomChip = document.createElement("div");
  bottomChip.className = "num-circle num-bottom";
  bottomChip.textContent = String(bottom);
  applyChipStyle(bottomChip, bottom);

  card.appendChild(topChip);
  card.appendChild(bottomChip);
  return card;
}
