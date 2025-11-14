// ==========================================
// 카드 렌더링 엔진 (DOM 방식, 안정적)
// ==========================================

window.drawScoutCard = function (top, bottom, w = 90, h = 130) {
  const el = document.createElement("div");
  el.className = "scout-card";
  el.style.width = w + "px";
  el.style.height = h + "px";
  el.style.border = "2px solid white";
  el.style.borderRadius = "12px";
  el.style.background = "#1e1e1e";
  el.style.color = "white";
  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontWeight = "700";
  el.style.userSelect = "none";

  el.innerHTML = `
    <div style="font-size:28px;">${top}</div>
    <div style="font-size:14px; opacity:0.7; margin-top:6px;">${bottom}</div>
  `;

  return el;
};
