import {
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
import {
  computeDose, computeGeneral, computeMixParts, computeRatio, convertVolume, roundMl,
} from './dilution.js';

const MODES = Object.freeze([
  Object.freeze({ id: 'general', label: 'General' }),
  Object.freeze({ id: 'ratio', label: 'Cleaning ratio' }),
  Object.freeze({ id: 'dose', label: 'Plant feed' }),
]);

const ERROR_COPY = Object.freeze({
  'target-exceeds-stock': 'That target is stronger than the stock — dilution can only weaken it.',
  invalid: 'Enter positive numbers to get a mix.',
});

const amount = (value) => `${formatNumber(roundMl(value))} ml`;
const partAmount = (value) => {
  const displayed = formatNumber(value, 1);
  return `${displayed} ${Number(displayed) === 1 ? 'part' : 'parts'}`;
};

const numericInput = (doc, { id, name, label, value = '', placeholder, onInput, extra }) => {
  const input = element('input', {
    id,
    name,
    type: 'text',
    inputmode: 'decimal',
    value,
    autocomplete: 'off',
    ...(placeholder ? { placeholder } : {}),
    ownerDocument: doc,
  });
  input.value = value;
  input.addEventListener('input', onInput);
  return element('div', { class: 'tool-field', ownerDocument: doc },
    element('label', { for: id, text: label, ownerDocument: doc }),
    extra ? element('div', { class: 'tool-inline', ownerDocument: doc }, input, extra) : input);
};

// The empty answer is a dashed slot holding one plain instruction; the full
// sentence appears only once there is something to compute.
const emptyResult = (doc, hint) => element('p', { class: 'tool-result tool-result-empty', ownerDocument: doc },
  element('span', { class: 'tool-result-hint', text: hint, ownerDocument: doc }));

// The General tab opens on a worked example (its own placeholder values), so
// the page arrives showing an answer the visitor can edit.
const GENERAL_EXAMPLE = Object.freeze({ stockPercent: '12', targetPercent: '3', totalMl: '500' });

const resultDisplay = (doc, announce, hint) => {
  const result = emptyResult(doc, hint);
  const error = (code) => {
    const text = ERROR_COPY[code] ?? ERROR_COPY.invalid;
    result.setAttribute('class', 'tool-error');
    result.replaceChildren(text);
    announce(text);
  };
  const mix = ({ concentrateMl, waterMl }, { stockPercent = null } = {}) => {
    const sourceLabel = stockPercent === null ? 'concentrate' : 'stock solution';
    const parts = stockPercent === null ? null : computeMixParts({ concentrateMl, waterMl });
    // Each half of the mix stays on one line (span.dilution-keep), with the
    // "+" opening the second half, so a narrow screen breaks only between them.
    // Text always sits in its own span (never a bare text node beside an
    // element), which keeps the DOM order simple to read and to test.
    const span = (text) => element('span', { text, ownerDocument: doc });
    const keep = (...children) => element('span', { class: 'dilution-keep', ownerDocument: doc },
      ...children.map((child) => (typeof child === 'string' ? span(child) : child)));
    const partsChildren = parts?.waterParts === 0
      ? [span(`No water needed — use the ${formatNumber(stockPercent)}% stock solution as-is.`)]
      : parts
        ? [span('About '), keep(`${partAmount(parts.concentrateParts)} ${formatNumber(stockPercent)}% stock solution`),
          span(' '), keep(`+ ${partAmount(parts.waterParts)} water.`)]
        : null;
    const partsText = partsChildren?.map((child) => child.textContent).join('') ?? null;
    const text = `Mix ${amount(concentrateMl)} ${sourceLabel} + ${amount(waterMl)} water${partsText ? ` ${partsText}` : ''}`;
    result.setAttribute('class', 'tool-result tool-result-strong');
    result.replaceChildren(
      element('span', { text: 'Mix ', ownerDocument: doc }),
      keep(element('strong', { text: amount(concentrateMl), ownerDocument: doc }), ` ${sourceLabel}`),
      span(' '),
      keep('+ ', element('strong', { text: amount(waterMl), ownerDocument: doc }), ' water'),
      ...(partsChildren ? [element('span', { class: 'tool-parts-result', ownerDocument: doc }, span(' '), ...partsChildren)] : []),
    );
    announce(text);
  };
  const dose = ({ doseMl }) => {
    const text = `Add ${amount(doseMl)} of feed`;
    result.setAttribute('class', 'tool-result tool-result-strong');
    result.replaceChildren(
      element('span', { text: 'Add ', ownerDocument: doc }),
      element('strong', { text: amount(doseMl), ownerDocument: doc }),
      element('span', { text: ' of feed', ownerDocument: doc }),
    );
    announce(text);
  };
  return { result, error, mix, dose };
};

export function renderDilutionTool(root, deps = {}) {
  const doc = root.ownerDocument ?? document;
  const storage = deps.storage ?? safeLocalStorage();
  const announce = deps.announce ?? createAnnouncer(document.querySelector('.tools-live-region'));
  let prefs = openToolPrefs(storage);
  const saved = toolPrefs(prefs, 'dilution');
  let mode = MODES.some(({ id }) => id === saved.mode) ? saved.mode : 'general';
  const body = toolShell(root, {
    title: 'Dilution Calculator',
    lede: 'Concentrate + water, without the algebra.',
  });

  const save = (bag) => {
    prefs = setToolPrefs(storage, prefs, 'dilution', { mode, ...bag });
  };

  const renderGeneral = () => {
    const form = element('form', { class: 'tool-form', ownerDocument: doc });
    // The worked example is computed silently; edits after that announce.
    let quiet = true;
    const display = resultDisplay(doc, (text) => { if (!quiet) announce(text); },
      'Fill in all three to see how much stock and water to mix.');
    const values = { ...GENERAL_EXAMPLE };
    const calculate = () => {
      const result = computeGeneral({
        stockPercent: parseDecimal(values.stockPercent),
        targetPercent: parseDecimal(values.targetPercent),
        totalMl: parseDecimal(values.totalMl),
      });
      if (result.error) display.error(result.error); else display.mix(result, {
        stockPercent: parseDecimal(values.stockPercent),
      });
    };
    const field = (id, name, label, placeholder) => numericInput(doc, {
      id, name, label, placeholder, value: values[name],
      onInput: (event) => { values[name] = event.currentTarget.value; calculate(); },
    });
    form.append(
      field('dilution-stock', 'stockPercent', 'Stock concentration (%)', 'e.g. 12'),
      field('dilution-target', 'targetPercent', 'Target concentration (%)', 'e.g. 3'),
      field('dilution-total', 'totalMl', 'Final volume (ml)', 'e.g. 500'),
      display.result,
    );
    calculate();
    quiet = false;
    return form;
  };

  const renderRatio = () => {
    const form = element('form', { class: 'tool-form', ownerDocument: doc });
    const display = resultDisplay(doc, announce, 'Pick a ratio and a bottle size to see the mix.');
    const ratioPrefs = toolPrefs(prefs, 'dilution');
    const values = {
      parts: ratioPrefs.ratioParts == null ? '' : String(ratioPrefs.ratioParts),
      totalMl: ratioPrefs.bottleMl == null ? '' : String(ratioPrefs.bottleMl),
    };
    const calculate = () => {
      const result = computeRatio({ parts: parseDecimal(values.parts), totalMl: parseDecimal(values.totalMl) });
      if (result.error) display.error(result.error); else display.mix(result);
    };
    const partsInput = numericInput(doc, {
      id: 'dilution-parts', name: 'parts', label: 'Water parts for 1 part concentrate', placeholder: 'e.g. 32', value: values.parts,
      onInput: (event) => {
        values.parts = event.currentTarget.value;
        save({ ratioParts: parseDecimal(values.parts) });
        calculate();
      },
    });
    const volumeInput = numericInput(doc, {
      id: 'dilution-ratio-total', name: 'totalMl', label: 'Custom bottle volume (ml)', placeholder: 'e.g. 750', value: values.totalMl,
      onInput: (event) => {
        values.totalMl = event.currentTarget.value;
        save({ bottleMl: parseDecimal(values.totalMl) });
        calculate();
      },
    });
    const quickPicks = element('div', { class: 'tool-quick-picks', role: 'group', 'aria-label': 'Common ratios', ownerDocument: doc },
      ...[10, 32, 64, 128].map((parts) => {
        const button = element('button', { type: 'button', class: 'tool-quick-pick', text: `1:${parts}`, ownerDocument: doc });
        button.addEventListener('click', () => {
          values.parts = String(parts);
          partsInput.querySelector('input').value = values.parts;
          save({ ratioParts: parts });
          calculate();
        });
        return button;
      }),
    );
    const bottles = element('div', { class: 'tool-bottle-presets', role: 'group', 'aria-label': 'Common bottle sizes', ownerDocument: doc },
      ...[
        ['500 ml', 500], ['750 ml', 750], ['1 L', 1000], ['5 L', 5000],
      ].map(([label, totalMl]) => {
        const button = element('button', { type: 'button', class: 'tool-bottle-preset', text: label, ownerDocument: doc });
        button.addEventListener('click', () => {
          values.totalMl = String(totalMl);
          volumeInput.querySelector('input').value = values.totalMl;
          save({ bottleMl: totalMl });
          calculate();
        });
        return button;
      }),
    );
    form.append(partsInput, quickPicks, volumeInput, bottles, display.result);
    return form;
  };

  const renderDose = () => {
    const form = element('form', { class: 'tool-form', ownerDocument: doc });
    const display = resultDisplay(doc, announce, 'Enter the feed dose and water volume to see how much feed to add.');
    const dosePrefs = toolPrefs(prefs, 'dilution');
    const values = {
      dosePerL: '',
      volume: '',
      volumeUnit: ['l', 'gal'].includes(dosePrefs.volumeUnit) ? dosePrefs.volumeUnit : 'l',
      multiplier: 1,
    };
    const calculate = () => {
      const totalL = convertVolume(parseDecimal(values.volume), values.volumeUnit, 'l');
      const result = computeDose({
        dosePerL: parseDecimal(values.dosePerL), totalL, multiplier: values.multiplier,
      });
      if (result.error) display.error(result.error); else display.dose(result);
    };
    const doseInput = numericInput(doc, {
      id: 'dilution-dose', name: 'dosePerL', label: 'Feed dose (ml per L)', placeholder: 'e.g. 2', value: values.dosePerL,
      onInput: (event) => { values.dosePerL = event.currentTarget.value; calculate(); },
    });
    const unit = element('select', { name: 'volumeUnit', 'aria-label': 'Volume unit', ownerDocument: doc },
      element('option', { value: 'l', text: 'L', ownerDocument: doc }),
      element('option', { value: 'gal', text: 'gal', ownerDocument: doc }),
    );
    unit.value = values.volumeUnit;
    unit.addEventListener('change', (event) => {
      values.volumeUnit = ['l', 'gal'].includes(event.currentTarget.value)
        ? event.currentTarget.value
        : 'l';
      unit.value = values.volumeUnit;
      save({ volumeUnit: values.volumeUnit });
      calculate();
    });
    const volumeInput = numericInput(doc, {
      id: 'dilution-volume', name: 'volume', label: 'Water volume', placeholder: 'e.g. 4', value: values.volume,
      onInput: (event) => { values.volume = event.currentTarget.value; calculate(); },
      extra: unit,
    });
    const strengthButtons = [['Weak', 0.5], ['Normal', 1], ['Strong', 1.5]].map(([label, multiplier]) => {
      const button = element('button', {
        type: 'button', class: 'tool-strength', text: label,
        'aria-pressed': String(values.multiplier === multiplier), ownerDocument: doc,
      });
      button.addEventListener('click', () => {
        values.multiplier = multiplier;
        for (const other of strengthButtons) {
          other.setAttribute('aria-pressed', String(other === button));
        }
        calculate();
      });
      return button;
    });
    const strengths = element('div', {
      class: 'tool-strengths', role: 'group', 'aria-label': 'Feed strength', ownerDocument: doc,
    }, ...strengthButtons);
    form.append(doseInput, volumeInput, strengths, display.result);
    return form;
  };

  const render = () => {
    const tabs = element('div', { class: 'tool-tabs', role: 'group', 'aria-label': 'Calculator', ownerDocument: doc }, ...MODES.map(({ id, label }) => {
      const tab = element('button', {
        type: 'button', class: `tool-tab${mode === id ? ' is-active' : ''}`, text: label,
        'aria-pressed': String(mode === id), ownerDocument: doc,
      });
      tab.addEventListener('click', () => {
        if (mode === id) return;
        mode = id;
        save({});
        render();
      });
      return tab;
    }));
    const form = mode === 'ratio' ? renderRatio() : mode === 'dose' ? renderDose() : renderGeneral();
    body.replaceChildren(tabs, form);
  };

  render();
}
