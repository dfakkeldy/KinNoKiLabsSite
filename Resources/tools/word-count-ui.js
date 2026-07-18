import { createAnnouncer, element, toolShell } from './core.js';
import { analyzeText, formatDuration } from './word-count.js';

const STAT_ROWS = Object.freeze([
  ['Words', (result) => result.words],
  ['Characters', (result) => result.characters],
  ['Characters without spaces', (result) => result.charactersNoSpaces],
  ['Sentences', (result) => result.sentences],
  ['Paragraphs', (result) => result.paragraphs],
  ['Silent reading', (result) => formatDuration(result.silentMinutes)],
  ['Read aloud', (result) => formatDuration(result.aloudMinutes)],
]);

export function renderWordCountTool(root, deps = {}) {
  const doc = root.ownerDocument ?? document;
  const announce = deps.announce ?? createAnnouncer(doc.querySelector('.tools-live-region'));
  const body = toolShell(root, {
    title: 'Word Counter',
    lede: 'Count words, characters, and reading time as you write.',
  });
  const form = element('form', { class: 'tool-form', ownerDocument: doc });
  const textarea = element('textarea', {
    id: 'word-count-text',
    name: 'text',
    class: 'tool-field',
    rows: '10',
    placeholder: 'Paste or write text here.',
    ownerDocument: doc,
  });
  const clear = element('button', { type: 'button', text: 'Clear', ownerDocument: doc });
  const list = element('dl', { class: 'tool-stats', ownerDocument: doc });
  const values = new Map(STAT_ROWS.map(([label]) => {
    const value = element('dd', { ownerDocument: doc });
    list.append(element('dt', { text: label, ownerDocument: doc }), value);
    return [label, value];
  }));

  const render = (shouldAnnounce = false) => {
    const result = analyzeText(textarea.value);
    for (const [label, format] of STAT_ROWS) values.get(label).textContent = String(format(result));
    if (shouldAnnounce) announce(`${result.words} words`);
  };

  textarea.addEventListener('input', () => render(true));
  clear.addEventListener('click', () => {
    textarea.value = '';
    render(true);
    textarea.focus();
  });

  form.append(
    element('label', { for: 'word-count-text', text: 'Text to count', ownerDocument: doc }),
    textarea,
    clear,
    list,
  );
  body.append(form);
  render();
}
