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
import { computeDose, computeGeneral, computeRatio, convertVolume, roundMl } from './dilution.js';

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

const numericInput = (doc, { id, name, label, value = '', onInput }) => {
  const input = element('input', {
    id,
    name,
    type: 'text',
    inputmode: 'decimal',
    value,
    ownerDocument: doc,
  });
  input.value = value;
  input.addEventListener('input', onInput);
  return element('label', { for: id, ownerDocument: doc }, label, input);
};

const resultDisplay = (doc, announce) => {
  const result = element('p', { class: 'tool-result', ownerDocument: doc });
  const error = (code) => {
    const text = ERROR_COPY[code] ?? ERROR_COPY.invalid;
    result.setAttribute('class', 'tool-error');
    result.replaceChildren(text);
    announce(text);
  };
  const mix = ({ concentrateMl, waterMl }) => {
    const text = `Mix ${amount(concentrateMl)} concentrate + ${amount(waterMl)} water`;
    result.setAttribute('class', 'tool-result-strong');
    result.replaceChildren(
      element('span', { text: 'Mix ', ownerDocument: doc }),
      element('strong', { text: amount(concentrateMl), ownerDocument: doc }),
      element('span', { text: ' concentrate + ', ownerDocument: doc }),
      element('strong', { text: amount(waterMl), ownerDocument: doc }),
      element('span', { text: ' water', ownerDocument: doc }),
    );
    announce(text);
  };
  const dose = ({ doseMl }) => {
    const text = `Add ${amount(doseMl)} of feed`;
    result.setAttribute('class', 'tool-result-strong');
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
    const display = resultDisplay(doc, announce);
    const values = { stockPercent: '', targetPercent: '', totalMl: '' };
    const calculate = () => {
      const result = computeGeneral({
        stockPercent: parseDecimal(values.stockPercent),
        targetPercent: parseDecimal(values.targetPercent),
        totalMl: parseDecimal(values.totalMl),
      });
      if (result.error) display.error(result.error); else display.mix(result);
    };
    const field = (id, name, label) => numericInput(doc, {
      id, name, label, value: values[name],
      onInput: (event) => { values[name] = event.currentTarget.value; calculate(); },
    });
    form.append(
      field('dilution-stock', 'stockPercent', 'Stock concentration (%)'),
      field('dilution-target', 'targetPercent', 'Target concentration (%)'),
      field('dilution-total', 'totalMl', 'Final volume (ml)'),
      display.result,
    );
    return form;
  };

  const renderRatio = () => {
    const form = element('form', { class: 'tool-form', ownerDocument: doc });
    const display = resultDisplay(doc, announce);
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
      id: 'dilution-parts', name: 'parts', label: 'Water parts for 1 part concentrate', value: values.parts,
      onInput: (event) => {
        values.parts = event.currentTarget.value;
        save({ ratioParts: parseDecimal(values.parts) });
        calculate();
      },
    });
    const volumeInput = numericInput(doc, {
      id: 'dilution-ratio-total', name: 'totalMl', label: 'Custom bottle volume (ml)', value: values.totalMl,
      onInput: (event) => {
        values.totalMl = event.currentTarget.value;
        save({ bottleMl: parseDecimal(values.totalMl) });
        calculate();
      },
    });
    const quickPicks = element('div', { class: 'tool-quick-picks', ownerDocument: doc },
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
    const bottles = element('div', { class: 'tool-bottle-presets', ownerDocument: doc },
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
    const display = resultDisplay(doc, announce);
    const values = { dosePerL: '', volume: '', volumeUnit: 'l', multiplier: 1 };
    const calculate = () => {
      const totalL = convertVolume(parseDecimal(values.volume), values.volumeUnit, 'l');
      const result = computeDose({
        dosePerL: parseDecimal(values.dosePerL), totalL, multiplier: values.multiplier,
      });
      if (result.error) display.error(result.error); else display.dose(result);
    };
    const doseInput = numericInput(doc, {
      id: 'dilution-dose', name: 'dosePerL', label: 'Feed dose (ml per L)', value: values.dosePerL,
      onInput: (event) => { values.dosePerL = event.currentTarget.value; calculate(); },
    });
    const volumeInput = numericInput(doc, {
      id: 'dilution-volume', name: 'volume', label: 'Water volume', value: values.volume,
      onInput: (event) => { values.volume = event.currentTarget.value; calculate(); },
    });
    const unit = element('select', { name: 'volumeUnit', 'aria-label': 'Volume unit', ownerDocument: doc },
      element('option', { value: 'l', text: 'L', ownerDocument: doc }),
      element('option', { value: 'gal', text: 'gal', ownerDocument: doc }),
    );
    unit.value = values.volumeUnit;
    unit.addEventListener('change', (event) => { values.volumeUnit = event.currentTarget.value; calculate(); });
    const strengths = element('div', { class: 'tool-strengths', ownerDocument: doc },
      ...[['Weak', 0.5], ['Normal', 1], ['Strong', 1.5]].map(([label, multiplier]) => {
        const button = element('button', { type: 'button', class: 'tool-strength', text: label, ownerDocument: doc });
        button.addEventListener('click', () => { values.multiplier = multiplier; calculate(); });
        return button;
      }),
    );
    form.append(doseInput, volumeInput, unit, strengths, display.result);
    return form;
  };

  const render = () => {
    const tabs = element('div', { class: 'tool-tabs', ownerDocument: doc }, ...MODES.map(({ id, label }) => {
      const tab = element('button', {
        type: 'button', class: 'tool-tab', text: label,
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
