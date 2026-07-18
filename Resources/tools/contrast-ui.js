import {
  createAnnouncer,
  element,
  formatNumber,
  openToolPrefs,
  safeLocalStorage,
  setToolPrefs,
  toolPrefs,
  toolShell,
} from './core.js';
import { contrastRatio, hexToRgb, rgbToHex, suggestPassing, verdicts } from './contrast.js';

const DEFAULTS = Object.freeze({ foreground: '#d4af37', background: '#0b0b0c' });
const TARGETS = Object.freeze([3, 4.5, 7]);
const VERDICT_ROWS = Object.freeze([
  ['aaNormal', 'AA normal text'],
  ['aaLarge', 'AA large text'],
  ['aaaNormal', 'AAA normal text'],
  ['aaaLarge', 'AAA large text'],
  ['uiComponent', 'UI components'],
]);

const normalizedHex = (value) => {
  const rgb = hexToRgb(value);
  return rgb ? rgbToHex(rgb) : null;
};

const option = (doc, value) => {
  const node = element('option', { value, text: `${value} : 1`, ownerDocument: doc });
  node.value = String(value);
  return node;
};

const colourField = (doc, { id, name, label, value, onTextInput, onColourInput }) => {
  const text = element('input', {
    id: `${id}-text`, name, type: 'text', inputmode: 'text', ownerDocument: doc,
  });
  const colour = element('input', {
    id: `${id}-colour`, name: `${name}Color`, type: 'color', 'aria-label': `${label} picker`, ownerDocument: doc,
  });
  text.value = value;
  colour.value = value;
  text.addEventListener('input', onTextInput);
  colour.addEventListener('input', onColourInput);
  return {
    text,
    colour,
    field: element('div', { class: 'tool-field', ownerDocument: doc },
      element('label', { for: `${id}-text`, text: label, ownerDocument: doc }), text, colour),
  };
};

export function renderContrastTool(root, deps = {}) {
  const doc = root.ownerDocument ?? document;
  const storage = deps.storage ?? safeLocalStorage();
  const announce = deps.announce ?? createAnnouncer(doc.querySelector('.tools-live-region'));
  let prefs = openToolPrefs(storage);
  const saved = toolPrefs(prefs, 'contrast');
  const values = {
    foreground: normalizedHex(saved.foreground) ?? DEFAULTS.foreground,
    background: normalizedHex(saved.background) ?? DEFAULTS.background,
  };
  let target = 4.5;

  const body = toolShell(root, {
    title: 'Contrast Checker',
    lede: 'Check WCAG contrast for text, controls, and colour pairs.',
  });
  const form = element('form', { class: 'tool-form', ownerDocument: doc });
  const results = element('div', { class: 'contrast-results', ownerDocument: doc });

  const save = () => {
    prefs = setToolPrefs(storage, prefs, 'contrast', { ...values });
  };

  const foreground = colourField(doc, {
    id: 'contrast-foreground', name: 'foreground', label: 'Foreground colour', value: values.foreground,
    onTextInput: (event) => {
      values.foreground = event.currentTarget.value;
      const normal = normalizedHex(values.foreground);
      if (normal) {
        values.foreground = normal;
        foreground.text.value = normal;
        foreground.colour.value = normal;
      }
      renderResults();
    },
    onColourInput: (event) => {
      values.foreground = event.currentTarget.value;
      foreground.text.value = values.foreground;
      renderResults();
    },
  });
  const background = colourField(doc, {
    id: 'contrast-background', name: 'background', label: 'Background colour', value: values.background,
    onTextInput: (event) => {
      values.background = event.currentTarget.value;
      const normal = normalizedHex(values.background);
      if (normal) {
        values.background = normal;
        background.text.value = normal;
        background.colour.value = normal;
      }
      renderResults();
    },
    onColourInput: (event) => {
      values.background = event.currentTarget.value;
      background.text.value = values.background;
      renderResults();
    },
  });

  const renderResults = () => {
    const foregroundHex = normalizedHex(values.foreground);
    const backgroundHex = normalizedHex(values.background);
    if (!foregroundHex || !backgroundHex) {
      const error = element('p', {
        class: 'tool-error', text: 'Enter valid hexadecimal colours to check contrast.', ownerDocument: doc,
      });
      results.replaceChildren(error);
      announce(error.textContent);
      return;
    }

    values.foreground = foregroundHex;
    values.background = backgroundHex;
    foreground.text.value = foregroundHex;
    foreground.colour.value = foregroundHex;
    background.text.value = backgroundHex;
    background.colour.value = backgroundHex;
    save();

    const ratio = contrastRatio(foregroundHex, backgroundHex);
    const checks = verdicts(ratio);
    const ratioText = formatNumber(ratio, 2);
    const headline = `Contrast ${ratioText} : 1`;
    const verdictList = element('ul', { class: 'tool-verdicts', ownerDocument: doc }, ...VERDICT_ROWS.map(([key, label]) => (
      element('li', { class: 'tool-verdict', text: `${label} — ${checks[key] ? 'pass' : 'fail'}`, ownerDocument: doc })
    )));
    const preview = element('div', { class: 'contrast-preview', ownerDocument: doc });
    const forward = element('p', {
      class: 'contrast-swatch', text: 'The quick brown fox jumps over the lazy dog.', ownerDocument: doc,
    });
    forward.style.setProperty('background-color', backgroundHex);
    forward.style.setProperty('color', foregroundHex);
    const reverse = element('p', {
      class: 'contrast-swatch', text: 'The quick brown fox jumps over the lazy dog.', ownerDocument: doc,
    });
    reverse.style.setProperty('background-color', foregroundHex);
    reverse.style.setProperty('color', backgroundHex);
    preview.append(forward, reverse);

    const suggestion = element('div', { class: 'contrast-suggestion', ownerDocument: doc });
    const targetSelect = element('select', {
      id: 'contrast-suggestion-target', name: 'suggestionTarget', ownerDocument: doc,
    }, ...TARGETS.map((value) => option(doc, value)));
    targetSelect.value = String(target);
    targetSelect.addEventListener('change', (event) => {
      target = Number(event.currentTarget.value);
      renderResults();
    });
    suggestion.append(
      element('label', { for: 'contrast-suggestion-target', text: 'Suggestion target', ownerDocument: doc }),
      targetSelect,
    );
    if (ratio < target) {
      const button = element('button', { type: 'button', text: 'Suggest a fix', ownerDocument: doc });
      button.addEventListener('click', () => {
        const next = suggestPassing(foregroundHex, backgroundHex, target);
        if (!next) {
          const error = element('p', {
            class: 'tool-error', text: 'No suggestion available for this pair and target.', ownerDocument: doc,
          });
          suggestion.append(error);
          announce(error.textContent);
          return;
        }
        values.foreground = next;
        foreground.text.value = next;
        foreground.colour.value = next;
        renderResults();
      });
      suggestion.append(button);
    }

    results.replaceChildren(
      element('p', { class: 'tool-result-strong', text: headline, ownerDocument: doc }),
      verdictList,
      preview,
      suggestion,
    );
    announce(`Contrast ${ratioText} to 1 — AA normal ${checks.aaNormal ? 'pass' : 'fail'}`);
  };

  form.append(foreground.field, background.field, results);
  body.append(form);
  renderResults();
}
