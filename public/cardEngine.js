// ===============================
// CARD ENGINE v3.0
// ===============================

// 숫자별 배경색
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

// ===============================
// 카드 캔버스 생성
// ===============================
export function drawScoutCard(top, bottom, w = 80, h = 120) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;

  const ctx = c.getContext("2d");

  // ==================================
  // 색상 분리된 상하단 배경
  // ==================================

  // 상단 색
  ctx.fillStyle = COLOR_MAP[top];
  ctx.fillRect(0, 0, w, h / 2);

  // 하단 색
  ctx.fillStyle = COLOR_MAP[bottom];
  ctx.fillRect(0, h / 2, w, h / 2);

  // 분리선
  ctx.fillStyle = "#000";
  ctx.fillRect(0, h / 2 - 1, w, 2);

  // 테두리
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, w, h);

  // ==================================
  // 숫자 표시
  // ==================================
  ctx.font = "bold 22px Arial";
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";

  // 위 숫자
  ctx.fillText(top, w / 2, h / 2 - 10);

  // 아래 숫자
  ctx.fillText(bottom, w / 2, h - 15);

  return c;
}
