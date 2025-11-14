// ================================
// SCOUT CARD DRAW ENGINE
// ================================

// 카드 크기 기본값
const DEFAULT_WIDTH = 85;
const DEFAULT_HEIGHT = 120;

/**
 * 단일 카드(Canvas) 생성 함수
 * top/bottom 숫자를 표시한 스카우트 카드 렌더링
 */
export function drawScoutCard(top, bottom, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  // 카드 배경
  ctx.fillStyle = "#fdfdfd";
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 3;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeRect(0, 0, width, height);

  // TOP 숫자 표시
  ctx.fillStyle = "#ff4444";
  ctx.font = `${width * 0.28}px bold sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(top, width / 2, height * 0.38);

  // 구분선
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.15, height / 2);
  ctx.lineTo(width * 0.85, height / 2);
  ctx.stroke();

  // BOTTOM 숫자 표시
  ctx.fillStyle = "#4444ff";
  ctx.font = `${width * 0.28}px bold sans-serif`;
  ctx.fillText(bottom, width / 2, height * 0.80);

  return canvas;
}

/**
 * 여러 장의 카드를 row 형태로 묶어주는 함수
 */
export function drawCardRow(cards, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, gap = 8) {
  const div = document.createElement("div");
  div.style.display = "flex";
  div.style.gap = `${gap}px`;

  cards.forEach(c => {
    div.append(drawScoutCard(c.top, c.bottom, width, height));
  });

  return div;
}
