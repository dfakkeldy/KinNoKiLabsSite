import {
  copyText,
  createAnnouncer,
  element,
  formatNumber,
  openToolPrefs,
  parseDecimal,
  safeLocalStorage,
  setToolPrefs,
  toolPrefs,
  toolShell,
} from './core.js';
import { BASE_NUMBERS, countClicks } from './click-counter.js';

const DEFAULT_BASE = 5;
const DEFAULT_TARGET = 2.5;

const savedBase = (value) => BASE_NUMBERS.includes(value) ? value : DEFAULT_BASE;
const savedTarget = (value) => Number.isFinite(value) && value >= 0 ? value : DEFAULT_TARGET;

// Whole-number shares of the 60-click scale, in words, so the headline says
// how far along the scale it lands. Other counts need no gloss.
const SCALE_SHARES = Object.freeze(new Map([
  [15, 'A quarter of the scale'],
  [20, 'A third of the scale'],
  [30, 'Half the scale'],
  [40, 'Two thirds of the scale'],
  [45, 'Three quarters of the scale'],
  [60, 'The full scale'],
]));

export function renderClickCounterTool(root, deps = {}) {
  const doc = root.ownerDocument ?? document;
  const storage = deps.storage ?? safeLocalStorage();
  const clipboard = deps.clipboard ?? globalThis.navigator?.clipboard;
  const announce = deps.announce ?? createAnnouncer(doc.querySelector('.tools-live-region'));
  let prefs = openToolPrefs(storage);
  const saved = toolPrefs(prefs, 'click-counter');
  let baseNumber = savedBase(saved.baseNumber);
  let targetNumber = savedTarget(saved.targetNumber);
  let currentClicks = countClicks(baseNumber, targetNumber);

  const body = toolShell(root, {
    title: 'Click Counter',
    lede: 'Convert a target number into clicks on a scale of 60 clicks.',
  });

  const form = element('form', { class: 'tool-form click-counter', ownerDocument: doc });
  form.addEventListener('submit', (event) => event.preventDefault());
  const presets = element('div', { class: 'click-counter-presets', ownerDocument: doc });
  const targetInput = element('input', {
    id: 'click-counter-target',
    name: 'targetNumber',
    type: 'number',
    min: '0',
    step: 'any',
    inputmode: 'decimal',
    autocomplete: 'off',
    ownerDocument: doc,
  });
  targetInput.value = formatNumber(targetNumber, 6);

  const result = element('section', {
    class: 'click-counter-result',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
    ownerDocument: doc,
  });
  const copyStatus = element('p', {
    class: 'click-counter-copy-status',
    'aria-live': 'polite',
    ownerDocument: doc,
  });

  const save = () => {
    prefs = setToolPrefs(storage, prefs, 'click-counter', { baseNumber, targetNumber });
  };

  const setSelectedPreset = () => {
    for (const button of presets.querySelectorAll('.click-counter-preset')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.baseNumber) === baseNumber));
    }
  };

  const resetButton = element('button', {
    class: 'tool-quiet', type: 'button', text: 'Reset', ownerDocument: doc,
  });
  // Reset only does something once the form has moved off its defaults, so
  // it stays out of sight until then rather than sitting there disabled.
  const syncReset = () => {
    const atDefaults = baseNumber === DEFAULT_BASE && parseDecimal(targetInput.value) === DEFAULT_TARGET;
    resetButton.disabled = atDefaults;
    resetButton.hidden = atDefaults;
  };

  const showResult = ({ shouldAnnounce = false, shouldSave = false } = {}) => {
    copyStatus.replaceChildren();
    syncReset();
    const parsedTarget = parseDecimal(targetInput.value);
    const clicks = parsedTarget === null ? null : countClicks(baseNumber, parsedTarget);
    if (clicks === null) {
      currentClicks = null;
      result.setAttribute('class', 'click-counter-result tool-error');
      result.replaceChildren('Enter a target number that is zero or greater.');
      if (shouldAnnounce) announce(result.textContent);
      return;
    }

    targetNumber = parsedTarget;
    currentClicks = clicks;
    result.setAttribute('class', 'click-counter-result');
    const value = element('output', {
      class: 'click-counter-value',
      for: 'click-counter-target',
      ownerDocument: doc,
    },
    element('span', { class: 'click-counter-number', text: String(clicks), ownerDocument: doc }),
    element('span', { class: 'click-counter-unit', text: ` ${clicks === 1 ? 'click' : 'clicks'}`, ownerDocument: doc }));
    const equation = element('p', {
      class: 'click-counter-equation',
      text: `${formatNumber(targetNumber, 6)} ÷ ${formatNumber(baseNumber, 6)} × 60`,
      ownerDocument: doc,
    });
    const share = SCALE_SHARES.get(clicks);
    result.replaceChildren(value, ...(share ? [element('p', {
      class: 'click-counter-share', text: share, ownerDocument: doc,
    })] : []), equation);
    if (shouldSave) save();
    if (shouldAnnounce) announce(value.textContent);
  };

  for (const number of BASE_NUMBERS) {
    const button = element('button', {
      class: 'click-counter-preset',
      type: 'button',
      'data-base-number': String(number),
      'aria-pressed': String(number === baseNumber),
      text: formatNumber(number),
      ownerDocument: doc,
    });
    button.addEventListener('click', () => {
      baseNumber = number;
      setSelectedPreset();
      showResult({ shouldAnnounce: true, shouldSave: true });
    });
    presets.append(button);
  }

  targetInput.addEventListener('input', () => {
    showResult({ shouldAnnounce: true, shouldSave: true });
  });

  const copyButton = element('button', {
    class: 'click-counter-copy tool-primary', type: 'button', text: 'Copy result', ownerDocument: doc,
  });
  copyButton.addEventListener('click', async () => {
    if (currentClicks === null) return;
    const text = `${currentClicks} ${currentClicks === 1 ? 'click' : 'clicks'}`;
    if (await copyText(text, clipboard)) {
      copyStatus.replaceChildren('Copied!');
      announce(`${text} copied.`);
    } else {
      const failure = 'Copy failed. Select the result and copy it manually.';
      copyStatus.replaceChildren(failure);
      announce(failure);
    }
  });

  resetButton.addEventListener('click', () => {
    baseNumber = DEFAULT_BASE;
    targetNumber = DEFAULT_TARGET;
    targetInput.value = formatNumber(targetNumber);
    setSelectedPreset();
    showResult({ shouldAnnounce: true, shouldSave: true });
    // Reset hides itself once the form is back at its defaults, so hand focus
    // to the target number rather than letting it drop to the page.
    targetInput.focus();
  });

  showResult();
  form.append(
    element('fieldset', { class: 'click-counter-fieldset', ownerDocument: doc },
      element('legend', { text: 'Base number (equals 60 clicks)', ownerDocument: doc }),
      presets),
    element('div', { class: 'tool-field click-counter-target', ownerDocument: doc },
      element('label', { for: 'click-counter-target', text: 'Target number', ownerDocument: doc }),
      targetInput),
    // The answer, its actions and the copy status are one group, so on wide
    // screens Copy sits right under the equation it copies.
    element('div', { class: 'click-counter-answer', ownerDocument: doc },
      result,
      element('div', { class: 'tool-actions click-counter-actions', ownerDocument: doc }, copyButton, resetButton),
      copyStatus),
  );
  body.append(form);
}
