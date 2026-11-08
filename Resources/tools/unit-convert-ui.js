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
import { CATEGORIES, convert } from './unit-convert.js';

const categoryFor = (id) => CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[0];
const unitFor = (category, id, fallback) => category.units.some((unit) => unit.id === id) ? id : fallback;

const unitOption = (doc, unit) => {
  const option = element('option', { value: unit.id, text: unit.label, ownerDocument: doc });
  option.value = unit.id;
  return option;
};

const populateUnits = (select, category, selected) => {
  select.replaceChildren(...category.units.map((unit) => unitOption(select.ownerDocument, unit)));
  select.value = unitFor(category, selected, category.units[0].id);
};

export function renderUnitTool(root, deps = {}) {
  const doc = root.ownerDocument ?? document;
  const storage = deps.storage ?? safeLocalStorage();
  const announce = deps.announce ?? createAnnouncer(doc.querySelector('.tools-live-region'));
  let prefs = openToolPrefs(storage);
  const saved = toolPrefs(prefs, 'unit-converter');
  let category = categoryFor(saved.category);
  // A first visit opens on a pair people look up (1 in = 2.54 cm) rather
  // than the list's first two units; saved choices still win.
  const firstVisitLength = saved.category === undefined && category.id === 'length';
  let fromId = unitFor(category, saved.from, firstVisitLength ? 'in' : category.units[0].id);
  let toId = unitFor(category, saved.to, firstVisitLength ? 'cm' : category.units[1].id);

  const body = toolShell(root, {
    title: 'Unit Converter',
    lede: 'Convert everyday units from length to data sizes.',
  });
  const form = element('form', { class: 'tool-form unit-converter', ownerDocument: doc });
  form.addEventListener('submit', (event) => event.preventDefault());
  const categorySelect = element('select', { id: 'unit-category', name: 'category', ownerDocument: doc },
    ...CATEGORIES.map(({ id, label }) => {
      const option = element('option', { value: id, text: label, ownerDocument: doc });
      option.value = id;
      return option;
    }));
  categorySelect.value = category.id;

  const fromInput = element('input', {
    id: 'unit-from-value', name: 'fromValue', type: 'text', inputmode: 'decimal', ownerDocument: doc,
  });
  const fromSelect = element('select', { id: 'unit-from', name: 'from', 'aria-label': 'From unit', ownerDocument: doc });
  const toInput = element('input', {
    id: 'unit-to-value', name: 'toValue', type: 'text', inputmode: 'decimal', ownerDocument: doc,
  });
  const toSelect = element('select', { id: 'unit-to', name: 'to', 'aria-label': 'To unit', ownerDocument: doc });
  const result = element('p', { class: 'tool-result', ownerDocument: doc });
  // The two boxes already show the conversion, so the visible line gives the
  // reverse rate instead; the full sentence stays for screen readers.
  const rate = element('p', { class: 'unit-rate', ownerDocument: doc });
  const SUMMARY_CLASS = 'tool-result-strong unit-summary visually-hidden';

  const save = () => {
    prefs = setToolPrefs(storage, prefs, 'unit-converter', {
      category: category.id, from: fromId, to: toId,
    });
  };

  const show = (shouldAnnounce) => {
    const fromValue = parseDecimal(fromInput.value);
    const toValue = parseDecimal(toInput.value);
    if (fromValue === null || toValue === null) return;
    const text = `${formatNumber(fromValue, 6)} ${fromId} = ${formatNumber(toValue, 6)} ${toId}`;
    result.setAttribute('class', SUMMARY_CLASS);
    result.replaceChildren(text);
    const inverse = fromId === toId ? null : convert(1, category.id, toId, fromId);
    if (inverse === null) rate.replaceChildren();
    else rate.replaceChildren(
      element('span', { class: 'unit-rate-label', text: 'The other way: ', ownerDocument: doc }),
      `1 ${toId} = ${formatNumber(inverse, 6)} ${fromId}`,
    );
    if (shouldAnnounce) announce(text);
  };

  const convertFrom = (source, shouldAnnounce = true) => {
    const sourceInput = source === 'from' ? fromInput : toInput;
    const targetInput = source === 'from' ? toInput : fromInput;
    const sourceValue = parseDecimal(sourceInput.value);
    if (sourceValue === null) {
      targetInput.value = '';
      rate.replaceChildren();
      result.setAttribute('class', 'tool-error');
      result.replaceChildren('Enter a valid number to convert.');
      if (shouldAnnounce) announce(result.textContent);
      return;
    }
    const converted = source === 'from'
      ? convert(sourceValue, category.id, fromId, toId)
      : convert(sourceValue, category.id, toId, fromId);
    if (converted === null) {
      targetInput.value = '';
      rate.replaceChildren();
      result.setAttribute('class', 'tool-error');
      result.replaceChildren('That conversion is out of range. Try a smaller value.');
      if (shouldAnnounce) announce(result.textContent);
      return;
    }
    targetInput.value = formatNumber(converted, 6);
    show(shouldAnnounce);
  };

  const syncUnits = () => {
    populateUnits(fromSelect, category, fromId);
    populateUnits(toSelect, category, toId);
    fromId = fromSelect.value;
    toId = toSelect.value;
  };

  fromInput.value = '1';
  syncUnits();
  convertFrom('from', false);

  categorySelect.addEventListener('change', (event) => {
    category = categoryFor(event.currentTarget.value);
    fromId = category.units[0].id;
    toId = category.units[1].id;
    syncUnits();
    save();
    convertFrom('from');
  });
  fromSelect.addEventListener('change', (event) => {
    fromId = event.currentTarget.value;
    save();
    convertFrom('from');
  });
  toSelect.addEventListener('change', (event) => {
    toId = event.currentTarget.value;
    save();
    convertFrom('from');
  });
  fromInput.addEventListener('input', () => convertFrom('from'));
  toInput.addEventListener('input', () => convertFrom('to'));

  form.append(
    element('div', { class: 'tool-field', ownerDocument: doc },
      element('label', { for: 'unit-category', text: 'Category', ownerDocument: doc }), categorySelect),
    element('div', { class: 'unit-pair', ownerDocument: doc },
      element('div', { class: 'tool-field', ownerDocument: doc },
        element('label', { for: 'unit-from-value', text: 'From', ownerDocument: doc }),
        element('div', { class: 'tool-inline unit-row', ownerDocument: doc }, fromInput, fromSelect)),
      element('span', { class: 'unit-equals', 'aria-hidden': 'true', text: '=', ownerDocument: doc }),
      element('div', { class: 'tool-field', ownerDocument: doc },
        element('label', { for: 'unit-to-value', text: 'To', ownerDocument: doc }),
        element('div', { class: 'tool-inline unit-row unit-row-to', ownerDocument: doc }, toInput, toSelect))),
    element('p', { class: 'tool-hint unit-hint', text: 'Type in either box; the other one updates.', ownerDocument: doc }),
    rate,
    result,
  );
  body.append(form);
}
