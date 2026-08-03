export const BASE_NUMBERS = Object.freeze([2.5, 5, 7.5, 10, 12.5, 15]);

export function countClicks(baseNumber, targetNumber) {
  if (!Number.isFinite(baseNumber) || baseNumber <= 0) return null;
  if (!Number.isFinite(targetNumber) || targetNumber < 0) return null;

  const exact = (targetNumber / baseNumber) * 60;
  if (!Number.isFinite(exact) || exact > Number.MAX_SAFE_INTEGER) return null;
  if (exact === 0) return 0;

  const tolerance = Number.EPSILON * Math.max(1, Math.abs(exact)) * 4;
  return Math.ceil(exact - tolerance);
}
