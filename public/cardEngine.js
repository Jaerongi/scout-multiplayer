// cardEngine.js
// 낮은 용량 + 고해상도 + 색상 규칙 적용된 스카우트 카드 렌더 엔진

/* ---------------------------
   🎨 숫자별 고유 색상 팔레트
----------------------------*/
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

/* ---------------------------
   📌 둥근 사각형 그리기
----------------------------*/
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

/* ----------------------------------------
   🎴 핵심 함수:
   drawScoutCard(top, bottom, width, height)
   → canvas 요소 반환
-----------------------------------------*/
export function drawScoutCard(top, bottom, width = 90, height = 130) {

  // 고해상도 레티나 대응 (2배)
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);

  /* ---------------------------
     카드 바탕 (흰 테두리)
  ----------------------------*/
  const radius = 12;
  ctx.fillStyle = "white";
  roundRect(ctx, 0, 0, width, height, radius);
  ctx.fill();

  /* ---------------------------
     상단(top 숫자)의 배경색
  ----------------------------*/
  ctx.fillStyle = COLOR_MAP[top];
  ctx.fillRect(4, 4, width - 8, height / 2 - 4);

  /* ---------------------------
     하단(bottom 숫자)의 배경색
  ----------------------------*/
  ctx.fillStyle = COLOR_MAP[bottom];
  ctx.fillRect(4, height / 2 + 2, width - 8, height / 2 - 6);

  /* ---------------------------
     중앙 구분선
  ----------------------------*/
  ctx.strokeStyle = "white";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(4, height / 2);
  ctx.lineTo(width - 4, height / 2);
  ctx.stroke();

  /* ---------------------------
     텍스트(숫자)
  ----------------------------*/
  ctx.fillStyle = "white";
  ctx.font = "bold 28px sans-serif";

  // top 숫자 (좌측 상단)
  ctx.textAlign = "left";
  ctx.fillText(String(top), 10, 34);

  // bottom 숫자 (우측 하단)
  ctx.textAlign = "right";
  ctx.fillText(String(bottom), width - 10, height - 12);

  return canvas;
}

/* ----------------------------------------
   🔄 카드 뒤집기 함수 (top↔bottom 전환)
-----------------------------------------*/
export function flipCard(card) {
  return {
    top: card.bottom,
    bottom: card.top
  };
}

/* ----------------------------------------
   🌟 카드 DOM Wrapper 생성
   (클릭/하이라이트에 사용)
-----------------------------------------*/
export function createCardElement(card, options = {}) {
  const { width = 90, height = 130, selectable = true } = options;
  
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.cursor = selectable ? "pointer" : "default";

  const canvas = drawScoutCard(card.top, card.bottom, width, height);
  wrapper.appendChild(canvas);

  return wrapper;
}
