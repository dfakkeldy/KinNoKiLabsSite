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

export function rgbToHex({ r, g, b }) {
  const part = (value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

const channel = (value) => {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance({ r, g, b }) {
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

function hslToRgb({ h, s, l }) {
  const saturation = s / 100;
  const lightness = l / 100;
  const k = (index) => (index + h / 30) % 12;
  const chroma = saturation * Math.min(lightness, 1 - lightness);
  const component = (index) => lightness
    - chroma * Math.max(-1, Math.min(k(index) - 3, 9 - k(index), 1));
  return { r: component(0) * 255, g: component(8) * 255, b: component(4) * 255 };
}

export function suggestPassing(fgHex, bgHex, target) {
  const foreground = hexToRgb(fgHex);
  if (!foreground || !hexToRgb(bgHex)) return null;

  const base = rgbToHsl(foreground);
  for (let delta = 1; delta <= 100; delta += 1) {
    for (const sign of [1, -1]) {
      const lightness = base.l + sign * delta;
      if (lightness < 0 || lightness > 100) continue;
      const candidate = rgbToHex(hslToRgb({ ...base, l: lightness }));
      if (contrastRatio(candidate, bgHex) >= target) return candidate;
    }
  }
  return null;
}
