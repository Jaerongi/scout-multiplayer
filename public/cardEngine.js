// ================================
// SCOUT CARD RENDER ENGINE (THEMED)
// ================================
//
// We render a themed card background (wave boundary) using the numeric COLOR_MAP,
// then optionally lay the official PNG deck as a subtle texture so that
// number->color consistency is always correct.
//
// File naming convention (optional texture):
//   /public/cards/{id:001..045}_{min}-{max}.png
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

function getTextColor(bgHex) {
  // quick luminance check for readability
  const hex = bgHex.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.72 ? "#1a1a1a" : "#ffffff";
}

function waveSvg(topColor, bottomColor) {
  // A simple diagonal wave boundary; encoded as SVG data URL
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="320" viewBox="0 0 220 320">
      <rect width="220" height="320" rx="24" ry="24" fill="${bottomColor}"/>
      <path d="M-10,140 C40,100 70,180 120,140 C160,110 190,170 240,135 L240,-10 L-10,-10 Z" fill="${topColor}"/>
      <!-- pastel-friendly highlight + soft shadow on the wave boundary -->
      <path d="M-10,150 C40,110 70,190 120,150 C160,120 190,180 240,145" fill="none" stroke="rgba(255,255,255,0.38)" stroke-width="9" stroke-linecap="round"/>
      <path d="M-10,150 C40,110 70,190 120,150 C160,120 190,180 240,145" fill="none" stroke="rgba(35,48,71,0.10)" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `.trim();
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// ================================
// drawScoutCard (THEMED DOM version)
// ================================
export function drawScoutCard(top, bottom) {
  const card = document.createElement("div");
  card.className = "scout-card themed-card";
  card.dataset.top = String(top);
  card.dataset.bottom = String(bottom);

  const topColor = COLOR_MAP[top] ?? "#999999";
  const bottomColor = COLOR_MAP[bottom] ?? "#555555";

  card.style.setProperty("--topColor", topColor);
  card.style.setProperty("--bottomColor", bottomColor);

  // background (wave)
  const bg = document.createElement("div");
  bg.className = "card-wave-bg";
  bg.style.backgroundImage = `url("${waveSvg(topColor, bottomColor)}")`;
  card.appendChild(bg);

  // optional official PNG as subtle texture (never rotated; purely decorative)
  const img = document.createElement("img");
  img.className = "card-texture";
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  img.src = `cards/${getCardFile(top, bottom)}`;
  card.appendChild(img);

  // number chips (always upright)
  const topChip = document.createElement("div");
  topChip.className = "num-circle top";
  topChip.textContent = String(top);
  topChip.style.setProperty("--chip-bg", topColor);
  topChip.style.setProperty("--chip-fg", getTextColor(topColor));

  const bottomChip = document.createElement("div");
  bottomChip.className = "num-circle bottom";
  bottomChip.textContent = String(bottom);
  bottomChip.style.setProperty("--chip-bg", bottomColor);
  bottomChip.style.setProperty("--chip-fg", getTextColor(bottomColor));

  card.appendChild(topChip);
  card.appendChild(bottomChip);

  return card;
}
