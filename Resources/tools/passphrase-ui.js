import {
  copyText,
  createAnnouncer,
  element,
  formatNumber,
  openToolPrefs,
  safeLocalStorage,
  setToolPrefs,
  toolPrefs,
  toolShell,
} from './core.js';
import { generatePassphrase, generateString } from './passphrase.js';
import { EFF_LARGE_WORDLIST } from './wordlist.js';

const MODES = Object.freeze([
  Object.freeze({ id: 'passphrase', label: 'Passphrase' }),
  Object.freeze({ id: 'string', label: 'Random string' }),
]);

const DEFAULTS = Object.freeze({
  mode: 'passphrase',
  words: 5,
  separator: '-',
  capitalize: false,
  includeNumber: false,
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: false,
});

const SEPARATORS = Object.freeze([
  Object.freeze({ value: '-', label: 'Hyphen (-)' }),
  Object.freeze({ value: ' ', label: 'Space' }),
  Object.freeze({ value: '_', label: 'Underscore (_)' }),
  Object.freeze({ value: '.', label: 'Period (.)' }),
]);

const isWordCount = (value) => Number.isInteger(value) && value >= 3 && value <= 8;
const isLength = (value) => Number.isInteger(value) && value >= 1 && value <= 1024;
const isSeparator = (value) => SEPARATORS.some(({ value: option }) => option === value);
const isMode = (value) => MODES.some(({ id }) => id === value);

const option = (doc, value, text) => {
  const node = element('option', { value, text, ownerDocument: doc });
  node.value = value;
  return node;
};

const checkbox = (doc, { name, label, checked, onChange }) => {
  const input = element('input', { name, type: 'checkbox', ownerDocument: doc });
  input.checked = checked;
  input.addEventListener('change', onChange);
  return element('label', { class: 'tool-check', ownerDocument: doc }, input, label);
};

const strengthFor = (entropyBits) => {
  if (entropyBits < 45) return 'Weak';
  if (entropyBits <= 70) return 'Good';
  return 'Strong';
};

export function renderPassphraseTool(root, deps = {}) {
  const doc = root.ownerDocument ?? document;
  const storage = deps.storage ?? safeLocalStorage();
  const announce = deps.announce ?? createAnnouncer(doc.querySelector('.tools-live-region'));
  const randomSource = deps.randomSource;
  const wordlist = deps.wordlist ?? EFF_LARGE_WORDLIST;
  let prefs = openToolPrefs(storage);
  const saved = toolPrefs(prefs, 'passphrase');
  const values = {
    mode: isMode(saved.mode) ? saved.mode : DEFAULTS.mode,
    words: isWordCount(saved.words) ? saved.words : DEFAULTS.words,
    separator: isSeparator(saved.separator) ? saved.separator : DEFAULTS.separator,
    capitalize: typeof saved.capitalize === 'boolean' ? saved.capitalize : DEFAULTS.capitalize,
    includeNumber: typeof saved.includeNumber === 'boolean' ? saved.includeNumber : DEFAULTS.includeNumber,
    length: isLength(saved.length) ? saved.length : DEFAULTS.length,
    lower: typeof saved.lower === 'boolean' ? saved.lower : DEFAULTS.lower,
    upper: typeof saved.upper === 'boolean' ? saved.upper : DEFAULTS.upper,
    digits: typeof saved.digits === 'boolean' ? saved.digits : DEFAULTS.digits,
    symbols: typeof saved.symbols === 'boolean' ? saved.symbols : DEFAULTS.symbols,
  };

  const body = toolShell(root, {
    title: 'Passphrase Generator',
    lede: 'Generate a memorable passphrase or a random string on this device.',
  });

  const save = () => {
    prefs = setToolPrefs(storage, prefs, 'passphrase', { ...values });
  };

  const renderResult = (container, result, kind) => {
    if (result.error) {
      const text = 'Select at least one character set.';
      container.replaceChildren(element('p', { class: 'tool-error', text, ownerDocument: doc }));
      announce(text);
      return;
    }

    const value = result.phrase ?? result.value;
    const tier = strengthFor(result.entropyBits);
    const entropy = `~${formatNumber(result.entropyBits, 0)} bits — ${tier}`;
    const copy = element('button', { type: 'button', text: 'Copy', ownerDocument: doc });
    copy.addEventListener('click', async () => {
      const copied = await copyText(value, deps.clipboard);
      if (copied) {
        announce('Copied');
        return;
      }
      const text = 'Unable to copy the generated value.';
      container.replaceChildren(
        element('p', { class: 'tool-result-strong', text: value, ownerDocument: doc }),
        element('p', { class: 'tool-result', text: entropy, ownerDocument: doc }),
        element('p', { class: 'tool-error', text, ownerDocument: doc }),
        copy,
      );
      announce(text);
    });
    container.replaceChildren(
      element('p', { class: 'tool-result-strong', text: value, ownerDocument: doc }),
      element('p', { class: 'tool-result', text: entropy, ownerDocument: doc }),
      copy,
    );
    announce(`Generated ${kind} — ${tier}`);
  };

  const renderError = (container) => {
    const text = 'Unable to generate a value. Check the selected options.';
    container.replaceChildren(element('p', { class: 'tool-error', text, ownerDocument: doc }));
    announce(text);
  };

  const resultArea = () => element('div', { class: 'passphrase-result', ownerDocument: doc });

  const renderPassphraseForm = () => {
    const form = element('form', { class: 'tool-form', ownerDocument: doc });
    const words = element('select', { id: 'passphrase-words', name: 'words', ownerDocument: doc },
      ...[3, 4, 5, 6, 7, 8].map((value) => option(doc, String(value), String(value))));
    words.value = String(values.words);
    words.addEventListener('change', (event) => {
      values.words = Number(event.currentTarget.value);
      save();
    });
    const separator = element('select', { id: 'passphrase-separator', name: 'separator', ownerDocument: doc },
      ...SEPARATORS.map(({ value, label }) => option(doc, value, label)));
    separator.value = values.separator;
    separator.addEventListener('change', (event) => {
      values.separator = event.currentTarget.value;
      save();
    });
    const results = resultArea();
    const generate = element('button', { type: 'button', text: 'Generate', ownerDocument: doc });
    generate.addEventListener('click', () => {
      try {
        renderResult(results, generatePassphrase({
          words: values.words,
          separator: values.separator,
          capitalize: values.capitalize,
          includeNumber: values.includeNumber,
        }, randomSource, wordlist), 'passphrase');
      } catch {
        renderError(results);
      }
    });
    form.append(
      element('label', { for: 'passphrase-words', text: 'Words', ownerDocument: doc }),
      words,
      element('label', { for: 'passphrase-separator', text: 'Separator', ownerDocument: doc }),
      separator,
      checkbox(doc, {
        name: 'capitalize', label: 'Capitalize words', checked: values.capitalize,
        onChange: (event) => { values.capitalize = event.currentTarget.checked; save(); },
      }),
      checkbox(doc, {
        name: 'includeNumber', label: 'Include a number', checked: values.includeNumber,
        onChange: (event) => { values.includeNumber = event.currentTarget.checked; save(); },
      }),
      generate,
      results,
      element('p', { class: 'tool-muted', text: 'Wordlist: EFF large wordlist (CC BY 3.0)', ownerDocument: doc }),
    );
    return form;
  };

  const renderStringForm = () => {
    const form = element('form', { class: 'tool-form', ownerDocument: doc });
    const length = element('input', {
      id: 'passphrase-length', name: 'length', type: 'number', min: '1', max: '1024', inputmode: 'numeric', ownerDocument: doc,
    });
    length.value = String(values.length);
    length.addEventListener('change', (event) => {
      values.length = Number(event.currentTarget.value);
      save();
    });
    const results = resultArea();
    const generate = element('button', { type: 'button', text: 'Generate', ownerDocument: doc });
    generate.addEventListener('click', () => {
      try {
        renderResult(results, generateString({
          length: values.length,
          lower: values.lower,
          upper: values.upper,
          digits: values.digits,
          symbols: values.symbols,
        }, randomSource), 'random string');
      } catch {
        renderError(results);
      }
    });
    form.append(
      element('label', { for: 'passphrase-length', text: 'Length', ownerDocument: doc }),
      length,
      checkbox(doc, {
        name: 'lower', label: 'Lowercase letters', checked: values.lower,
        onChange: (event) => { values.lower = event.currentTarget.checked; save(); },
      }),
      checkbox(doc, {
        name: 'upper', label: 'Uppercase letters', checked: values.upper,
        onChange: (event) => { values.upper = event.currentTarget.checked; save(); },
      }),
      checkbox(doc, {
        name: 'digits', label: 'Digits', checked: values.digits,
        onChange: (event) => { values.digits = event.currentTarget.checked; save(); },
      }),
      checkbox(doc, {
        name: 'symbols', label: 'Symbols', checked: values.symbols,
        onChange: (event) => { values.symbols = event.currentTarget.checked; save(); },
      }),
      generate,
      results,
    );
    return form;
  };

  const render = () => {
    const tabs = element('div', { class: 'tool-tabs', ownerDocument: doc }, ...MODES.map(({ id, label }) => {
      const tab = element('button', {
        type: 'button', class: 'tool-tab', text: label,
        'aria-pressed': String(values.mode === id), ownerDocument: doc,
      });
      tab.addEventListener('click', () => {
        if (values.mode === id) return;
        values.mode = id;
        save();
        render();
      });
      return tab;
    }));
    body.replaceChildren(tabs, values.mode === 'passphrase' ? renderPassphraseForm() : renderStringForm());
  };

  render();
}
