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
export function drawScoutCard(top, bottom, w = 90, h = 130) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  const mid = h / 2;

  // 상단 영역
  ctx.fillStyle = COLOR_MAP[top];
  ctx.fillRect(0, 0, w, mid);

  // 하단 영역
  ctx.fillStyle = COLOR_MAP[bottom];
  ctx.fillRect(0, mid, w, mid);

  // 숫자 (흰색)
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px Pretendard, sans-serif";
  ctx.textAlign = "center";

  ctx.fillText(top, w / 2, mid / 1.5);
  ctx.fillText(bottom, w / 2, mid + mid / 1.3);

  return canvas;
}
