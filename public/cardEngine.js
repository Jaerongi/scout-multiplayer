import { COLOR_MAP } from "./shared.js";

// ===============================================
// 카드 1장 HTML 생성
// ===============================================
export function drawScoutCard(top, bottom, w = 60, h = 90) {
  const wrap = document.createElement("div");
  wrap.className = "cardBox";
  wrap.style.width = w + "px";
  wrap.style.height = h + "px";

  wrap.style.background = `
    linear-gradient(
      to bottom,
      ${COLOR_MAP[top]} 50%,
      ${COLOR_MAP[bottom]} 50%
    )
  `;

  wrap.innerHTML = `
    <div class="topNum">${top}</div>
    <div class="bottomNum">${bottom}</div>
  `;

  return wrap;
}
