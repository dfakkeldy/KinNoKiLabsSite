export function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  const raw = hex.trim().replace(/^#/, '');
  const six = /^[0-9a-f]{6}$/i.test(raw) ? raw
    : /^[0-9a-f]{3}$/i.test(raw) ? [...raw].map((char) => char + char).join('') : null;
  if (!six) return null;
  return {
    r: parseInt(six.slice(0, 2), 16),
    g: parseInt(six.slice(2, 4), 16),
    b: parseInt(six.slice(4, 6), 16),
  };
}

export function rgbToHex(rgb) {
  if (!rgb || typeof rgb !== 'object') return null;
  const { r, g, b } = rgb;
  if (![r, g, b].every(Number.isFinite)) return null;
  const part = (value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

const channel = (value) => {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(rgb) {
  if (!rgb || typeof rgb !== 'object') return null;
  const { r, g, b } = rgb;
  if (![r, g, b].every(Number.isFinite)) return null;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return null;
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((left, right) => right - left);
  return (hi + 0.05) / (lo + 0.05);
}

export function verdicts(ratio) {
  return {
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
    uiComponent: ratio >= 3,
  };
}

function rgbToHsl({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lightness * 100 };

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue = max === red ? ((green - blue) / delta + (green < blue ? 6 : 0))
    : max === green ? (blue - red) / delta + 2
      : (red - green) / delta + 4;
  return { h: hue * 60, s: saturation * 100, l: lightness * 100 };
}

function hslChannelWeights(h) {
  const k = (index) => (index + h / 30) % 12;
  return [0, 8, 4].map((index) => Math.max(-1, Math.min(k(index) - 3, 9 - k(index), 1)));
}

function hslToRgb({ h, s, l }) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = saturation * Math.min(lightness, 1 - lightness);
  const weights = hslChannelWeights(h);
  const component = (channel) => lightness
    - chroma * weights[channel];
  return { r: component(0) * 255, g: component(1) * 255, b: component(2) * 255 };
}

function roundedRgbBoundaries({ h, s, l }) {
  const saturation = s / 100;
  const base = l / 100;
  const points = [0, 0.5, 1, base];
  const addSegmentBoundaries = (start, end, alpha, beta) => {
    if (Math.abs(alpha) < Number.EPSILON) return;
    for (let boundary = 0.5; boundary < 255; boundary += 1) {
      const point = (boundary - beta) / alpha;
      if (point > start && point < end) points.push(point);
    }
  };

  for (const weight of hslChannelWeights(h)) {
    addSegmentBoundaries(0, 0.5, 255 * (1 - saturation * weight), 0);
    addSegmentBoundaries(0.5, 1, 255 * (1 + saturation * weight), -255 * saturation * weight);
  }

  return points.sort((left, right) => left - right)
    .filter((point, index, sorted) => index === 0 || point - sorted[index - 1] > 1e-12);
}

function compareSuggestion(left, right) {
  if (!right || left.distance < right.distance - 1e-12) return -1;
  if (left.distance > right.distance + 1e-12) return 1;
  if (left.direction !== right.direction) return left.direction - right.direction;
  return left.hex.localeCompare(right.hex);
}

export function suggestPassing(fgHex, bgHex, target) {
  const foreground = hexToRgb(fgHex);
  const background = hexToRgb(bgHex);
  if (!foreground || !background || !Number.isFinite(target) || target < 1 || target > 21) return null;

  const normalizedForeground = rgbToHex(foreground);
  const normalizedBackground = rgbToHex(background);
  if (contrastRatio(normalizedForeground, normalizedBackground) >= target) return normalizedForeground;

  const base = rgbToHsl(foreground);
  const baseLightness = base.l / 100;
  const boundaries = roundedRgbBoundaries(base);
  let best = null;
  const evaluate = (lightness, distance = Math.abs(lightness - baseLightness), closest = lightness) => {
    const hex = rgbToHex(hslToRgb({ ...base, l: lightness * 100 }));
    if (contrastRatio(hex, normalizedBackground) >= target) {
      const suggestion = { hex, distance, direction: closest >= baseLightness ? 0 : 1 };
      if (compareSuggestion(suggestion, best) < 0) best = suggestion;
    }
  };

  for (let index = 0; index < boundaries.length; index += 1) {
    evaluate(boundaries[index]);
    if (index === boundaries.length - 1) continue;
    const start = boundaries[index];
    const end = boundaries[index + 1];
    const midpoint = (start + end) / 2;
    const closest = Math.min(end, Math.max(start, baseLightness));
    evaluate(midpoint, Math.abs(closest - baseLightness), closest);
  }
  return best?.hex ?? null;
}
