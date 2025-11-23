// =============================
// SCOUT shared rules (Final Version)
// =============================

// 카드 생성 (45장)
export function createDeck() {
  const deck = [];
  let id = 1;

  for (let i = 0; i < 45; i++) {
    const top = rand(1, 10);
    const bottom = rand(1, 10);

    deck.push({
      id: id++,
      top,
      bottom,
    });
  }

  shuffle(deck);
  return deck;
}

// 랜덤 숫자
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 피셔-예이츠 셔플
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// --------------------------------------------------------------
// 선택한 카드의 실제 값 구하기 (top 또는 bottom)
// --------------------------------------------------------------
export function getCardValue(card, direction = "top") {
  return direction === "top" ? card.top : card.bottom;
}

// --------------------------------------------------------------
// 콤보 타입 판별
// --------------------------------------------------------------
export function getComboType(combo) {
  if (!combo || combo.length === 0) return null;
  if (combo.length === 1) return "single";

  const nums = combo.map(c => c.value);

  // SET: 모든 숫자가 동일
  const setCheck = nums.every(n => n === nums[0]);
  if (setCheck) return "set";

  // RUN: 오름차순 or 내림차순
  const asc = nums.slice().sort((a, b) => a - b);
  const desc = nums.slice().sort((a, b) => b - a);

  const isAsc = nums.every((v, i) => v === asc[i]);
  const isDesc = nums.every((v, i) => v === desc[i]);

  if (isAsc || isDesc) return "run";

  return null;
}

// --------------------------------------------------------------
// 콤보 강함 비교
// --------------------------------------------------------------
export function isStrongerCombo(newCombo, oldCombo) {
  // oldCombo가 없음 → 항상 새 콤보가 강함
  if (!oldCombo) return true;

  const t1 = getComboType(newCombo);
  const t2 = getComboType(oldCombo);

  if (!t1 || !t2) return false;

  const typeRank = { single: 1, set: 2, run: 3 };

  // 1) 콤보 종류 비교
  if (typeRank[t1] > typeRank[t2]) return true;
  if (typeRank[t1] < typeRank[t2]) return false;

  // 2) 같은 콤보 종류라면 상세 비교
  const v1 = newCombo.map(c => c.value);
  const v2 = oldCombo.map(c => c.value);

  // SET 비교 (개수 → 숫자)
  if (t1 === "set") {
    if (v1.length > v2.length) return true;
    if (v1.length < v2.length) return false;

    // 개수 같으면 숫자 비교
    return v1[0] > v2[0];
  }

  // RUN 비교 (길이 → 첫 숫자)
  if (t1 === "run") {
    if (v1.length > v2.length) return true;
    if (v1.length < v2.length) return false;

    // 길이 같으면 시작 숫자 비교
    return v1[0] > v2[0];
  }

  // SINGLE 비교
  return v1[0] > v2[0];
}

// --------------------------------------------------------------
// SCOUT 삽입 검증
// --------------------------------------------------------------
export function canInsertAt(handLength, index) {
  return index >= 0 && index <= handLength; // 보통 끝까지 가능
}
