// ================================
// SCOUT CARD DRAW ENGINE (COLOR VERSION)
// ================================

const DEFAULT_WIDTH = 85;
const DEFAULT_HEIGHT = 120;

// 숫자별 색상 매핑
const COLOR_MAP = {
  1: "#ff5c5c",
  2: "#ff914d",
  3: "#ffd84d",
  4: "#c9ff4d",
  5: "#6dff6d",
  6: "#7ee7ff",
  7: "#4da6ff",
  8: "#c44dff",
  9: "#ff4dd8",
  10: "#aaaaaa"
};

/**
 * 스카우트 카드 렌더링
 */
export function drawScoutCard(top, bottom, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // 카드 배경 (top 기반 색상)
  ctx.fillStyle = COLOR_MAP[top] || "#fff";
  ctx.fillRect(0, 0, width, height);

  // 테두리
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, width, height);

  // TOP 숫자
  ctx.fillStyle = "#000";
  ctx.font = `${width * 0.28}px bold sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(top, width / 2, height * 0.38);

  // 구분선
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.15, height / 2);
  ctx.lineTo(width * 0.85, height / 2);
  ctx.stroke();

  // BOTTOM 숫자
  ctx.fillText(bottom, width / 2, height * 0.80);

  return canvas;
}
