// =====================================
// SCOUT CARD RENDERING (PREMIUM UI)
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

export function drawScoutCard(top, bottom, w = 100, h = 140) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  /* --------------------------
     라운드 테두리
  --------------------------- */
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 6;

  // 카드 배경
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#222";

  roundRect(ctx, 0, 0, w, h, 15);
  ctx.fill();
  ctx.stroke();

  /* --------------------------
     상·하 배경색
  --------------------------- */
  ctx.fillStyle = COLOR_MAP[top];
  roundRect(ctx, 0, 0, w, h / 2, 15, "top");
  ctx.fill();

  ctx.fillStyle = COLOR_MAP[bottom];
  roundRect(ctx, 0, h / 2, w, h / 2, 15, "bottom");
  ctx.fill();

  /* --------------------------
     중간 구분선
  --------------------------- */
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(10, h / 2);
  ctx.lineTo(w - 10, h / 2);
  ctx.stroke();

  /* --------------------------
     숫자
  --------------------------- */
  ctx.fillStyle = "#000";
  ctx.font = `bold ${w * 0.32}px Pretendard, Arial`;
  ctx.textAlign = "center";

  ctx.fillText(top, w / 2, h * 0.35);
  ctx.fillText(bottom, w / 2, h * 0.82);

  return canvas;
}

/* =====================================
   둥근 사각형 그리는 함수
===================================== */
function roundRect(ctx, x, y, w, h, r, mode = "full") {
  const rTop = mode === "top" || mode === "full" ? r : 0;
  const rBottom = mode === "bottom" || mode === "full" ? r : 0;

  ctx.beginPath();
  ctx.moveTo(x + w - rTop, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rTop);
  ctx.lineTo(x + w, y + h - rBottom);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rBottom, y + h);
  ctx.lineTo(x + rBottom, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rBottom);
  ctx.lineTo(x, y + rTop);
  ctx.quadraticCurveTo(x, y, x + rTop, y);
  ctx.closePath();
}
