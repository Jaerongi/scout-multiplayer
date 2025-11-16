import { COLOR_MAP } from "./shared.js";

export function drawScoutCard(top, bottom, w = 60, h = 90) {
  const wrap = document.createElement("div");
  wrap.className = "cardBox";
  wrap.style.width = w + "px";
  wrap.style.height = h + "px";
  wrap.style.borderRadius = "10px";
  wrap.style.border = "2px solid white";
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.justifyContent = "space-between";
  wrap.style.padding = "6px";

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
