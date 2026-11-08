import { createAnnouncer, element, toolShell } from './core.js';
import { analyzeText, formatDuration } from './word-count.js';

// The first two rows are the headline tiles; the rest are secondary counts.
// With no words the time tiles read "0 min" (a number like every other
// tile) rather than claiming "under a minute".
const readingTime = (result, minutes) => (result.words === 0 ? '0 min' : formatDuration(minutes));
const STAT_ROWS = Object.freeze([
  ['Words', (result) => result.words],
  ['Read aloud', (result) => readingTime(result, result.aloudMinutes)],
  ['Silent reading', (result) => readingTime(result, result.silentMinutes)],
  ['Characters', (result) => result.characters],
  ['Characters without spaces', (result) => result.charactersNoSpaces],
  ['Sentences', (result) => result.sentences],
  ['Paragraphs', (result) => result.paragraphs],
]);
const HEADLINE_STATS = 2;

export function renderWordCountTool(root, deps = {}) {
  const doc = root.ownerDocument ?? document;
  const announce = deps.announce ?? createAnnouncer(doc.querySelector('.tools-live-region'));
  const body = toolShell(root, {
    title: 'Word Counter',
    lede: 'Count words, characters, and reading time as you write.',
  });
  const form = element('form', { class: 'tool-form word-count', ownerDocument: doc });
  form.addEventListener('submit', (event) => event.preventDefault());
  const textarea = element('textarea', {
    id: 'word-count-text',
    name: 'text',
    class: 'tool-field',
    rows: '10',
    placeholder: 'Paste or write text here. Read-aloud time updates as you type.',
    ownerDocument: doc,
  });
  const clear = element('button', { type: 'button', class: 'tool-quiet', text: 'Clear', ownerDocument: doc });
  const list = element('dl', { class: 'tool-stats', ownerDocument: doc });
  const values = new Map(STAT_ROWS.map(([label], index) => {
    const value = element('dd', { ownerDocument: doc });
    list.append(element('div', {
      class: index < HEADLINE_STATS ? 'tool-stat is-headline' : 'tool-stat', ownerDocument: doc,
    }, element('dt', { text: label, ownerDocument: doc }), value));
    return [label, value];
  }));

  const render = (shouldAnnounce = false) => {
    const result = analyzeText(textarea.value);
    for (const [label, format] of STAT_ROWS) values.get(label).textContent = String(format(result));
    clear.disabled = textarea.value === '';
    clear.hidden = clear.disabled;
    if (shouldAnnounce) announce(`${result.words} words`);
  };

  textarea.addEventListener('input', () => render(true));
  clear.addEventListener('click', () => {
    textarea.value = '';
    render(true);
    textarea.focus();
  });

  form.append(
    element('div', { class: 'word-count-input', ownerDocument: doc },
      element('label', { for: 'word-count-text', text: 'Text to count', ownerDocument: doc }),
      element('div', { class: 'word-count-actions', ownerDocument: doc }, clear),
      textarea),
    list,
  );
  body.append(form);
  render();
}
