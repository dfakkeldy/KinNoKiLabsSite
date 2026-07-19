export const SILENT_WPM = 240;
export const ALOUD_WPM = 155;

export function analyzeText(text) {
  const value = typeof text === 'string' ? text : '';
  const characters = [...value].length;
  const charactersNoSpaces = [...value.replace(/\s/gu, '')].length;
  const words = value.trim()
    ? [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(value)]
      .filter((segment) => segment.isWordLike).length
    : 0;
  const sentences = value.trim()
    ? [...new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(value)]
      .filter((segment) => segment.segment.trim().length > 0).length
    : 0;
  const paragraphs = value.trim()
    ? value.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length
    : 0;

  return {
    characters,
    charactersNoSpaces,
    words,
    sentences,
    paragraphs,
    silentMinutes: words / SILENT_WPM,
    aloudMinutes: words / ALOUD_WPM,
  };
}

export function formatDuration(minutes) {
  if (minutes < 1) return 'under a minute';
  const whole = Math.round(minutes);
  if (whole < 60) return `≈ ${whole} min`;
  return `≈ ${Math.floor(whole / 60)} hr ${whole % 60} min`;
}
