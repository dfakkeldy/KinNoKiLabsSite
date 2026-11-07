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

const SEPARATOR_WORDS = Object.freeze({
  '-': 'hyphens', ' ': 'spaces', _: 'underscores', '.': 'periods',
});

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
  const generatePassphraseFn = deps.generatePassphraseFn ?? generatePassphrase;
  const generateStringFn = deps.generateStringFn ?? generateString;
  let prefs = openToolPrefs(storage);
  let currentResultToken = 0;
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

  const invalidateResult = () => {
    currentResultToken += 1;
    return currentResultToken;
  };

  const renderResult = (container, result, kind) => {
    const resultToken = invalidateResult();
    if (result.error) {
      const text = 'Select at least one character set.';
      container.replaceChildren(element('p', { class: 'tool-error', text, ownerDocument: doc }));
      announce(text);
      return;
    }

    const value = result.phrase ?? result.value;
    const tier = strengthFor(result.entropyBits);
    const entropy = `~${formatNumber(result.entropyBits, 0)} bits — ${tier}`;
    const copy = element('button', { type: 'button', class: 'passphrase-copy', text: 'Copy', ownerDocument: doc });
    copy.addEventListener('click', async () => {
      const copied = await copyText(value, deps.clipboard);
      if (resultToken !== currentResultToken) return;
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
    invalidateResult();
    const text = 'Unable to generate a value. Check the selected options.';
    container.replaceChildren(element('p', { class: 'tool-error', text, ownerDocument: doc }));
    announce(text);
  };

  // Before the first Generate the slot shows the answer's shape: a masked
  // preview (dots, joined by the real separator) over a one-line caption,
  // so every option shows its effect while no secret is on screen. Nothing
  // is generated until asked; after that, changing an option rolls a fresh
  // value. The mask is decoration; the caption carries the meaning.
  const resultArea = (describe) => {
    const mask = element('span', { class: 'passphrase-mask', 'aria-hidden': 'true', ownerDocument: doc });
    const caption = element('span', { class: 'passphrase-caption', ownerDocument: doc });
    const placeholder = element('p', { class: 'passphrase-placeholder', ownerDocument: doc }, mask, caption);
    const container = element('div', { class: 'passphrase-result', ownerDocument: doc }, placeholder);
    const refresh = () => {
      const { shape, text } = describe();
      // A passphrase shape is a list of words: each one (with the separator
      // after it) is its own unbreakable span, so lines break between words.
      mask.replaceChildren(...(Array.isArray(shape)
        ? shape.map((word) => element('span', { class: 'passphrase-mask-word', text: word, ownerDocument: doc }))
        : [shape]));
      mask.hidden = shape.length === 0;
      caption.textContent = text;
    };
    refresh();
    return { container, refresh };
  };

  // Fixed, typical EFF word lengths: the preview's rhythm never changes
  // from one visit to the next, and it never hints at a real word.
  const GHOST_WORD_LENGTHS = [6, 5, 7, 4, 6, 5, 7, 6];
  const DOT = '•';

  const describePassphrase = () => {
    const extras = [values.capitalize ? 'capitalized' : null, values.includeNumber ? 'with a number' : null]
      .filter(Boolean).join(', ');
    const words = GHOST_WORD_LENGTHS.slice(0, values.words).map((length) => DOT.repeat(length));
    if (values.includeNumber) words.push('#');
    return {
      shape: words.map((word, index) => (index < words.length - 1 ? `${word}${values.separator}` : word)),
      text: `${values.words} words joined with ${SEPARATOR_WORDS[values.separator] ?? 'a separator'}${extras ? `, ${extras}` : ''}. Press Generate to make one.`,
    };
  };

  const describeString = () => {
    const sets = [
      values.lower ? 'lowercase' : null, values.upper ? 'uppercase' : null,
      values.digits ? 'digits' : null, values.symbols ? 'symbols' : null,
    ].filter(Boolean);
    if (sets.length === 0) return { shape: '', text: 'Choose at least one character set below.' };
    const list = sets.length === 1 ? sets[0] : `${sets.slice(0, -1).join(', ')} and ${sets.at(-1)}`;
    const shown = isLength(values.length) ? Math.min(values.length, 24) : 0;
    return {
      shape: `${DOT.repeat(shown)}${isLength(values.length) && values.length > 24 ? '…' : ''}`,
      text: `${values.length} characters of ${list}. Press Generate to make one.`,
    };
  };

  const optionFlow = (run, area) => {
    let generated = false;
    return {
      generate: () => { generated = true; run(); },
      changed: () => {
        save();
        if (generated) run(); else area.refresh();
      },
    };
  };

  const labelledField = (id, label, control) => element('div', { class: 'tool-field', ownerDocument: doc },
    element('label', { for: id, text: label, ownerDocument: doc }), control);

  const renderPassphraseForm = () => {
    const form = element('form', { class: 'tool-form passphrase-form', ownerDocument: doc });
    form.addEventListener('submit', (event) => event.preventDefault());
    const words = element('select', { id: 'passphrase-words', name: 'words', ownerDocument: doc },
      ...[3, 4, 5, 6, 7, 8].map((value) => option(doc, String(value), String(value))));
    words.value = String(values.words);
    words.addEventListener('change', (event) => {
      values.words = Number(event.currentTarget.value);
      flow.changed();
    });
    const separator = element('select', { id: 'passphrase-separator', name: 'separator', ownerDocument: doc },
      ...SEPARATORS.map(({ value, label }) => option(doc, value, label)));
    separator.value = values.separator;
    separator.addEventListener('change', (event) => {
      values.separator = event.currentTarget.value;
      flow.changed();
    });
    const area = resultArea(describePassphrase);
    const results = area.container;
    const flow = optionFlow(() => {
      try {
        renderResult(results, generatePassphraseFn({
          words: values.words,
          separator: values.separator,
          capitalize: values.capitalize,
          includeNumber: values.includeNumber,
        }, randomSource, wordlist), 'passphrase');
      } catch {
        renderError(results);
      }
    }, area);
    const generate = element('button', { type: 'button', class: 'tool-primary', text: 'Generate', ownerDocument: doc });
    generate.addEventListener('click', flow.generate);
    form.append(
      results,
      element('div', { class: 'tool-actions', ownerDocument: doc }, generate),
      element('div', { class: 'passphrase-options', ownerDocument: doc },
        labelledField('passphrase-words', 'Words', words),
        labelledField('passphrase-separator', 'Separator', separator),
        checkbox(doc, {
          name: 'capitalize', label: 'Capitalize words', checked: values.capitalize,
          onChange: (event) => { values.capitalize = event.currentTarget.checked; flow.changed(); },
        }),
        checkbox(doc, {
          name: 'includeNumber', label: 'Include a number', checked: values.includeNumber,
          onChange: (event) => { values.includeNumber = event.currentTarget.checked; flow.changed(); },
        })),
      element('p', { class: 'tool-muted', text: 'Wordlist: EFF large wordlist (CC BY 3.0)', ownerDocument: doc }),
    );
    return form;
  };

  const renderStringForm = () => {
    const form = element('form', { class: 'tool-form passphrase-form', ownerDocument: doc });
    form.addEventListener('submit', (event) => event.preventDefault());
    const length = element('input', {
      id: 'passphrase-length', name: 'length', type: 'number', min: '1', max: '1024', inputmode: 'numeric', ownerDocument: doc,
    });
    length.value = String(values.length);
    length.addEventListener('change', (event) => {
      values.length = Number(event.currentTarget.value);
      flow.changed();
    });
    const area = resultArea(describeString);
    const results = area.container;
    const flow = optionFlow(() => {
      try {
        renderResult(results, generateStringFn({
          length: values.length,
          lower: values.lower,
          upper: values.upper,
          digits: values.digits,
          symbols: values.symbols,
        }, randomSource), 'random string');
      } catch {
        renderError(results);
      }
    }, area);
    const generate = element('button', { type: 'button', class: 'tool-primary', text: 'Generate', ownerDocument: doc });
    generate.addEventListener('click', flow.generate);
    form.append(
      results,
      element('div', { class: 'tool-actions', ownerDocument: doc }, generate),
      element('div', { class: 'passphrase-options', ownerDocument: doc },
        labelledField('passphrase-length', 'Length', length),
        checkbox(doc, {
          name: 'lower', label: 'Lowercase letters', checked: values.lower,
          onChange: (event) => { values.lower = event.currentTarget.checked; flow.changed(); },
        }),
        checkbox(doc, {
          name: 'upper', label: 'Uppercase letters', checked: values.upper,
          onChange: (event) => { values.upper = event.currentTarget.checked; flow.changed(); },
        }),
        checkbox(doc, {
          name: 'digits', label: 'Digits', checked: values.digits,
          onChange: (event) => { values.digits = event.currentTarget.checked; flow.changed(); },
        }),
        checkbox(doc, {
          name: 'symbols', label: 'Symbols', checked: values.symbols,
          onChange: (event) => { values.symbols = event.currentTarget.checked; flow.changed(); },
        })),
    );
    return form;
  };

  const render = () => {
    const tabs = element('div', { class: 'tool-tabs', role: 'group', 'aria-label': 'What to generate', ownerDocument: doc }, ...MODES.map(({ id, label }) => {
      const tab = element('button', {
        type: 'button', class: `tool-tab${values.mode === id ? ' is-active' : ''}`, text: label,
        'aria-pressed': String(values.mode === id), ownerDocument: doc,
      });
      tab.addEventListener('click', () => {
        if (values.mode === id) return;
        values.mode = id;
        save();
        invalidateResult();
        render();
      });
      return tab;
    }));
    body.replaceChildren(tabs, values.mode === 'passphrase' ? renderPassphraseForm() : renderStringForm());
  };

  render();
}
