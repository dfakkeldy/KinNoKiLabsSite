export const VOLUME_UNITS = Object.freeze([
  Object.freeze({ id: 'ml', label: 'ml', ml: 1 }),
  Object.freeze({ id: 'l', label: 'L', ml: 1000 }),
  Object.freeze({ id: 'tsp', label: 'tsp (US)', ml: 4.92892 }),
  Object.freeze({ id: 'tbsp', label: 'tbsp (US)', ml: 14.7868 }),
  Object.freeze({ id: 'floz', label: 'fl oz (US)', ml: 29.5735 }),
  Object.freeze({ id: 'cup', label: 'cup (US)', ml: 236.588 }),
  Object.freeze({ id: 'gal', label: 'gal (US)', ml: 3785.41 }),
]);

const unitMl = (id) => VOLUME_UNITS.find((unit) => unit.id === id)?.ml ?? null;
const positive = (value) => Number.isFinite(value) && value > 0;

export function convertVolume(value, fromId, toId) {
  const from = unitMl(fromId);
  const to = unitMl(toId);
  if (from === null || to === null || !Number.isFinite(value)) return null;
  return (value * from) / to;
}

/**
 * Rounds millilitres to 2 decimal places below 1 ml, 1 below 1000 ml, and 0 otherwise.
 */
export function roundMl(value) {
  const decimalPlaces = value < 1 ? 2 : value < 1000 ? 1 : 0;
  return Number(value.toFixed(decimalPlaces));
}

export function computeGeneral({ stockPercent, targetPercent, totalMl }) {
  if (![stockPercent, targetPercent, totalMl].every(positive) || stockPercent > 100) {
    return { error: 'invalid' };
  }
  if (targetPercent > stockPercent) return { error: 'target-exceeds-stock' };
  const concentrateMl = (targetPercent / stockPercent) * totalMl;
  return { concentrateMl, waterMl: totalMl - concentrateMl };
}

export function computeRatio({ parts, totalMl }) {
  if (![parts, totalMl].every(positive)) return { error: 'invalid' };
  const concentrateMl = totalMl / (1 + parts);
  return { concentrateMl, waterMl: totalMl - concentrateMl };
}

export function computeDose({ dosePerL, totalL, multiplier = 1 }) {
  if (![dosePerL, totalL, multiplier].every(positive)) return { error: 'invalid' };
  return { doseMl: dosePerL * totalL * multiplier };
}

export function partsToPercent(parts) {
  return positive(parts) ? 100 / (1 + parts) : null;
}

export function percentToParts(percent) {
  if (!positive(percent) || percent >= 100) return null;
  return 100 / percent - 1;
}
