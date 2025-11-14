// =====================================
// SCOUT CARD RENDERING ENGINE (FINAL)
// =====================================

// 색상 매핑 (선한피클님 제공 기준)
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

/* ---------------------------------------------------
   SCOUT 카드 생성 함수 — canvas 렌더링
   (UI 안정화된 최종본)
--------------------------------------------------- */
export function drawScoutCard(top, bottom, w = 90, h = 130) {

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");

  /* --------------------------
     1) 전체 배경
  --------------------------- */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  /* --------------------------
     2) 테두리 (보드게임 스타일)
  --------------------------- */
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#111";
  ctx.strokeRect(0, 0, w, h);

  /* --------------------------
     3) 상·하 배경 색
  --------------------------- */
  ctx.fillStyle = COLOR_MAP[top];
  ctx.fillRect(0, 0, w, h / 2);

  ctx.fillStyle = COLOR_MAP[bottom];
  ctx.fillRect(0, h / 2, w, h / 2);

  /* --------------------------
     4) 중간 구분선
  --------------------------- */
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(8, h / 2);
  ctx.lineTo(w - 8, h / 2);
  ctx.stroke();

  /* --------------------------
     5) 숫자 배치
  --------------------------- */
  ctx.textAlign = "center";
  ctx.fillStyle = "#000000";
  ctx.font = `bold ${w * 0.32}px Arial`;

  // top 숫자 (상단 중앙)
  ctx.fillText(top, w / 2, h * 0.35);

  // bottom 숫자 (하단 중앙)
  ctx.fillText(bottom, w / 2, h * 0.82);

  return canvas;
}
