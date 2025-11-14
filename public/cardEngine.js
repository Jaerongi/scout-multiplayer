// =====================================
// SCOUT CARD RENDERING (OPTIMIZED SIZE)
// =====================================

export const COLOR_MAP = {
  1: "#5c6ae6",
  2: "#3b4df5",
  3: "#74c1e8",
  4: "#31b3bd",
  5: "#31bd7c",
  6: "#7be39c",
  7: "#f2fa0a",
  8: "#c7cc35",
  9: "#f2c913",
  10: "#fa2e23"
};

export function drawScoutCard(top, bottom, w = 65, h = 90) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  /* --------------------------
     카드 외곽 테두리
  --------------------------- */
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 4;

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#222";

  roundRect(ctx, 0, 0, w, h, 10);
  ctx.fill();
  ctx.stroke();

  /* --------------------------
     상·하 색 영역
  --------------------------- */
  ctx.fillStyle = COLOR_MAP[top];
  roundRect(ctx, 0, 0, w, h / 2, 10, "top");
  ctx.fill();

  ctx.fillStyle = COLOR_MAP[bottom];
  roundRect(ctx, 0, h / 2, w, h / 2, 10, "bottom");
  ctx.fill();

  /* --------------------------
     중간 라인
  --------------------------- */
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(6, h / 2);
  ctx.lineTo(w - 6, h / 2);
  ctx.stroke();

  /* --------------------------
     숫자 (크기 최적화)
  --------------------------- */
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.font = `bold ${w * 0.40}px Pretendard, Arial`;

  ctx.fillText(top, w / 2, h * 0.34);
  ctx.fillText(bottom, w / 2, h * 0.82);

  return canvas;
}

/* =====================================
   둥근 사각형 (위·아래 분리 지원)
===================================== */
function roundRect(ctx, x, y, w, h, r, mode = "full") {
  const tl = mode === "top" || mode === "full" ? r : 0;
  const tr = mode === "top" || mode === "full" ? r : 0;
  const bl = mode === "bottom" || mode === "full" ? r : 0;
  const br = mode === "bottom" || mode === "full" ? r : 0;

  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}
