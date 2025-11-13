// =====================================
// SCOUT CARD RENDERING ENGINE (canvas)
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
   카드 생성 함수 (canvas)
--------------------------------------------------- */
export function drawScoutCard(top, bottom, w = 80, h = 120) {

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");

  // 배경
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  // 보드게임 스타일의 두꺼운 테두리
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#000";
  ctx.strokeRect(0, 0, w, h);

  // 가운데 구분선
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(10, h / 2);
  ctx.lineTo(w - 10, h / 2);
  ctx.stroke();

  // TOP 영역 색
  ctx.fillStyle = COLOR_MAP[top];
  ctx.fillRect(0, 0, w, h / 2);

  // BOTTOM 영역 색
  ctx.fillStyle = COLOR_MAP[bottom];
  ctx.fillRect(0, h / 2, w, h / 2);

  // 글자 스타일
  ctx.fillStyle = "#000";
  ctx.font = `bold ${w * 0.3}px Noto Sans KR`;
  ctx.textAlign = "center";

  // top 숫자
  ctx.fillText(top, w / 2, h * 0.33);

  // bottom 숫자
  ctx.fillText(bottom, w / 2, h * 0.77);

  return canvas;
}
