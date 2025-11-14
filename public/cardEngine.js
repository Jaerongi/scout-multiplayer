// ================================
// SCOUT CARD DRAW ENGINE (Two Color Split Version)
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
 * 스카우트 카드 렌더링 (위/아래 2색 분할 버전)
 */
export function drawScoutCard(top, bottom, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // ===============================
  // 🔥 2색 배경 분할
  // ===============================

  // 상단 영역 색(top)
  ctx.fillStyle = COLOR_MAP[top];
  ctx.fillRect(0, 0, width, height / 2);

  // 하단 영역 색(bottom)
  ctx.fillStyle = COLOR_MAP[bottom];
  ctx.fillRect(0, height / 2, width, height / 2);

  // 테두리
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, width, height);

  // ===============================
  // 텍스트 (TOP)
  // ===============================
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = `${width * 0.28}px bold sans-serif`;
  ctx.fillText(top, width / 2, height * 0.38);

  // ===============================
  // 구분선
  // ===============================
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.15, height / 2);
  ctx.lineTo(width * 0.85, height / 2);
  ctx.stroke();

  // ===============================
  // 텍스트 (BOTTOM)
  // ===============================
  ctx.fillText(bottom, width / 2, height * 0.83);

  return canvas;
}
