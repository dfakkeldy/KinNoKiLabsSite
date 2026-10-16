import { assessSnapshot, decimal, formatCents, formatDate, formatPrice, formatTimestamp, groupForecasts, loadSnapshot, publicUrl } from './gas-core.js';
import { forecastComparison, renderComparison } from './gas-chart.js';

const BOARD_URL = 'https://nserbt.ca/nseb/mandates/gasoline-diesel-pricing/gasoline-diesel-prices-zone-map';
const messages = {
  invalid_data: 'The public data is unavailable or could not be validated. Estimates and watch are hidden.',
  feed_error: 'The updater could not verify fresh data. Estimates and watch are hidden; the last verified official order is shown below.',
  future_data: 'The data has a future check time. Estimates and watch are hidden until the timestamp can be verified.',
  stale: 'The last source check is more than three hours old. Estimates and watch are hidden; the last verified official order is shown below.',
  official_unavailable: 'A verified official order is unavailable. Check the Board source for current prices.',
  invalid_target: 'A current Friday target could not be verified. Estimates and watch are hidden.',
  expired: 'The previous estimate has expired. Waiting for a verified official order and a new Friday estimate.',
  official_pending: "Waiting for this Friday's official order before estimating the following week. Estimates and watch are hidden.",
  invalid_estimate: 'The estimate could not be validated. Estimates and watch are hidden; the last verified official order is shown below.',
};
const modeLabels = { complete: 'All quotes observed', provisional: 'Some quotes assumed', extrapolation: 'Outside training range' };
const count = (value) => Number.isInteger(value) && value >= 0 ? String(value) : 'Unavailable';

export function mountGasWatch(root, { document = root.ownerDocument, window = globalThis.window, fetcher = globalThis.fetch, now = () => new Date() } = {}) {
  function el(tag, className, text, attrs = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    return node;
  }
  function link(text, url, className = 'link-quiet') {
    const safe = publicUrl(url);
    return safe ? el('a', className, text, { href: safe }) : el('span', '', text);
  }
  function detail(title, children, className = '') {
    const node = el('details', `gas-details ${className}`.trim());
    node.append(el('summary', '', title), ...children);
    return node;
  }
  function table(caption, headings, rows) {
    const wrap = el('div', 'gas-table-wrap', null, { tabindex: '0', role: 'region', 'aria-label': caption });
    const tableNode = el('table', 'gas-table');
    const head = el('thead'); const headRow = el('tr');
    for (const heading of headings) headRow.append(el('th', '', heading, { scope: 'col' }));
    head.append(headRow); const body = el('tbody'); body.append(...rows);
    tableNode.append(el('caption', '', caption), head, body); wrap.append(tableNode); return wrap;
  }
  function section(title, description, className) {
    const node = el('section', `gas-section ${className}`);
    const head = el('div', 'section-head');
    head.append(el('h2', 'section-title', title));
    if (description) head.append(el('p', 'section-lede', description));
    node.append(head); return node;
  }
  function statistic(title, value, note) {
    const node = el('div', 'gas-stat');
    node.append(el('h3', '', title), el('p', 'gas-stat-value', value), el('p', '', note)); return node;
  }
  const toolbar = el('div', 'gas-toolbar');
  const zoneField = el('div', 'gas-zone-field');
  const controls = el('div', 'gas-zone-controls');
  const select = el('select', '', null, { id: 'gas-zone', name: 'zone' });
  for (let zone = 1; zone <= 6; zone += 1) select.append(el('option', '', `Zone ${zone}`, { value: String(zone) }));
  select.value = '6';
  controls.append(select, link('Find your pricing zone', BOARD_URL));
  zoneField.append(el('label', '', 'Pricing zone', { for: 'gas-zone' }), controls);
  const refreshButton = el('button', 'btn btn-gray gas-refresh', 'Check for updates', { type: 'button' });
  toolbar.append(zoneField, refreshButton);
  const feedStatus = el('p', 'gas-feed-status', 'Checking the latest public data…', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const content = el('div', 'gas-content');
  root.replaceChildren(toolbar, feedStatus, content);

  let data = null; let source = 'none'; let zone = 6; let busy = false; let lastFetch = now().getTime(); let lastReason;
  let comparisonIssue = 'first';
  function selected(zones) { return zones?.find((price) => price.zone === zone); }
  function currentCard(view) {
    const card = el('article', 'gas-card');
    const top = el('div', 'gas-card-top');
    top.append(el('h2', '', 'Official regular price'), el('span', 'gas-badge', `Zone ${zone}`)); card.append(top);
    const price = selected(view.current?.zones);
    if (!price) {
      card.append(el('p', 'gas-empty', 'Official price unavailable'), el('p', 'gas-card-note', 'Use the Board source to check the latest official order.'), link('Official prices and zone map', BOARD_URL));
      return card;
    }
    card.append(el('p', 'gas-price gas-current-price', formatPrice(price.minimum)), el('p', 'gas-price-unit', 'Minimum · CAD per litre'),
      el('p', 'gas-price-maximum', `Maximum ${formatPrice(price.maximum)} / L`), el('p', 'gas-card-note', 'Regular gasoline · self-service'),
      el('p', 'gas-card-note', `Official order effective ${formatDate(view.current.date)} at 12:01 a.m. Atlantic.`), link('Read the official order', view.current.source_url));
    const components = el('dl', 'gas-components');
    for (const [key, label] of [['benchmark', 'Benchmark'], ['forward', 'Forward correction'], ['clean_fuel', 'Clean fuel adjustment'], ['credit_card', 'Credit card adjustment']]) {
      const row = el('div'); row.append(el('dt', '', label), el('dd', '', formatCents(view.current[key], { digits: 2 }))); components.append(row);
    }
    card.append(detail('Published pricing components', [components])); return card;
  }
  function estimateCard(view) {
    const card = el('article', 'gas-card gas-card-estimate');
    const top = el('div', 'gas-card-top');
    top.append(el('h2', '', 'Conditional Friday estimate'), el('span', 'gas-badge', 'Experimental')); card.append(top);
    const estimate = view.estimate; const price = selected(estimate?.zones);
    if (!price) {
      card.append(el('p', 'gas-empty', 'Estimate withheld'), el('p', 'gas-card-note', view.reason ? messages[view.reason] : 'Waiting for enough verified data to issue an estimate.'),
        el('p', 'gas-card-note', 'A fresh official order and recent source check are required.'));
      return card;
    }
    const current = selected(view.current.zones);
    const change = Number((decimal(price.minimum) - decimal(current.minimum)).toFixed(1));
    const movement = change < 0 ? `Down ${formatCents(String(-change))}` : change > 0 ? `Up ${formatCents(String(change))}` : 'No change';
    card.append(el('p', 'gas-price gas-estimate-price', formatPrice(price.minimum)), el('p', 'gas-price-unit', 'Estimated minimum · CAD per litre'),
      el('p', 'gas-price-maximum', `Estimated maximum ${formatPrice(price.maximum)} / L`),
      el('p', 'gas-card-note', `For ${formatDate(estimate.date)} · ${modeLabels[estimate.mode]}`),
      el('p', 'gas-change', `${movement} from the official minimum`),
      el('p', 'gas-coverage', `${estimate.observed_quotes} of ${estimate.total_quotes} weekday quotes observed · ${estimate.projected_quotes} assumed unchanged`),
      el('p', 'gas-card-note', `Latest real quote ${formatDate(estimate.latest_quote_date)}. Issued ${formatTimestamp(estimate.issued_at)}.`));
    if (estimate.projected_quotes > 0) card.append(el('p', 'gas-card-note', 'Remaining weekdays hold the last real quote. New quotes replace these assumptions.'));
    if (estimate.error_reference !== null) card.append(el('p', 'gas-card-note', `Historical absolute-error reference ±${formatCents(estimate.error_reference)}. This retrospective reference offers no confidence guarantee.`));
    if (estimate.outside_training_features.length) {
      card.append(el('p', 'gas-notice', `Outside the training range: ${estimate.outside_training_features.join('; ')}`));
    }
    const assumptions = el('ul');
    for (const assumption of estimate.assumptions) assumptions.append(el('li', '', assumption));
    card.append(detail('What this estimate assumes', [assumptions, el('p', 'gas-card-note', `Model ${estimate.model_version}. Expires at 12:01 a.m. Atlantic on the setting date.`)])); return card;
  }
  function allZones(view) {
    const rows = [];
    for (let id = 1; id <= 6; id += 1) {
      const current = view.current?.zones.find((price) => price.zone === id);
      const estimate = view.estimate?.zones.find((price) => price.zone === id);
      const row = el('tr', '', null, { 'data-selected': id === zone ? 'true' : 'false' });
      row.append(el('th', '', `Zone ${id}`, { scope: 'row' }), el('td', '', formatPrice(current?.minimum)), el('td', '', formatPrice(current?.maximum)),
        el('td', '', estimate ? formatPrice(estimate.minimum) : 'Withheld'), el('td', '', estimate ? formatPrice(estimate.maximum) : 'Withheld')); rows.push(row);
    }
    return detail('Compare all six zones', [table('Regular self-service gasoline · CAD per litre', ['Zone', 'Official minimum', 'Official maximum', 'Estimated minimum', 'Estimated maximum'], rows)], 'gas-all-zones');
  }
  function performanceSection() {
    const node = section('What the tests show', 'Retrospective errors in cents per litre. Early estimates have less observed data and have missed by more.', 'gas-performance');
    const performance = data?.performance; const complete = performance?.complete;
    const rolling = Array.isArray(performance?.rolling) ? performance.rolling.filter((row) => Number.isInteger(row?.lead_days) && row.lead_days >= 1 && row.lead_days <= 7 && decimal(row.mae) !== null && decimal(row.max_error) !== null) : [];
    const early = rolling.find((row) => row.lead_days === 7); const late = rolling.find((row) => row.lead_days === 1);
    const grid = el('div', 'gas-stat-grid');
    grid.append(statistic('Complete-window v2', formatCents(complete?.mae, { digits: 2 }), `${count(complete?.count)} later conditional price settings · mean absolute error`),
      statistic('7 days before Friday', formatCents(early?.mae, { digits: 2 }), `${count(early?.count)} Friday outcomes · mean absolute error`),
      statistic('1 day before Friday', formatCents(late?.mae, { digits: 2 }), `${count(late?.count)} Friday outcomes · mean absolute error`)); node.append(grid);
    if (rolling.length) {
      const maximum = Math.max(...rolling.map((row) => decimal(row.max_error)));
      node.append(el('p', 'gas-section-note', `The largest held-out rolling miss was ${formatCents(String(maximum))}. Each horizon is a separate test of the same Friday outcomes.`));
      const rows = rolling.sort((a, b) => b.lead_days - a.lead_days).map((row) => {
        const tr = el('tr'); tr.append(el('th', '', `${row.lead_days} ${row.lead_days === 1 ? 'day' : 'days'}`, { scope: 'row' }), el('td', '', `${count(row.count)} of ${count(row.total)}`),
          el('td', '', formatCents(row.mae, { digits: 2 })), el('td', '', formatCents(row.max_error))); return tr;
      });
      node.append(detail('Errors at every lead time', [table('Rolling estimates, grouped by days before Friday', ['Lead time', 'Friday outcomes', 'Mean absolute error', 'Largest error'], rows)]));
    }
    node.append(el('p', 'gas-section-note', `The original v2 test uses complete quote windows; its largest error was ${formatCents(complete?.max_error)}. Historical quote publication times have not been reconstructed, and these tests were not blinded. The complete-window test and the rolling test use different samples. Prospective outcomes are tracked separately below.`));
    return node;
  }
  function watchSection(view) {
    const node = el('section', 'gas-watch');
    const heading = el('div', 'gas-watch-heading');
    heading.append(el('h2', 'section-title', 'Interrupter watch'), el('span', 'gas-badge', 'Experimental')); node.append(heading);
    const watch = view.watch;
    if (!watch) node.append(el('p', 'gas-watch-status', 'Watch withheld'), el('p', 'gas-watch-description', view.reason ? messages[view.reason] : 'No verified quote signal is available.'));
    else {
      const labels = { below_reference: `Below the ${formatCents(watch.reference_cents)} reference`, single_quote_move: 'One quote crosses the reference', sustained_proxy_move: 'Sustained quote move across the reference', waiting_for_quotes: 'Waiting for real quotes', unavailable: 'Quote signal unavailable' };
      node.append(el('p', 'gas-watch-status', labels[watch.status]));
      if (watch.latest_gap !== null && !['waiting_for_quotes', 'unavailable'].includes(watch.status)) node.append(el('p', 'gas-watch-gap', formatCents(watch.latest_gap, { signed: true, digits: 2 })), el('p', 'gas-price-unit', 'Latest estimated combined supply-cost gap'));
      const observations = el('ul', 'gas-observations');
      for (const item of watch.observations.slice(-5)) observations.append(el('li', '', `${formatDate(item.date)} · ${formatCents(item.supply_gap, { signed: true, digits: 2 })}`));
      node.append(observations);
      if (watch.regular_setting_next) node.append(el('p', 'gas-card-note', 'The next scheduled setting is the regular Friday order.'));
      node.append(el('p', 'gas-watch-description', watch.limitations), link('Board guidance on interruptions', watch.source_url));
    }
    node.append(el('p', 'gas-watch-description', "Real rack quotes estimate a combined supply-cost gap. The Board uses its own daily NYH benchmark and discretion. This watch cannot confirm an actual trigger or give an interruption probability."));
    const performance = data?.performance?.watch;
    if (performance) {
      const rows = [['Early signal', performance.early], ['Sustained signal', performance.sustained]].map(([label, value]) => {
        const tr = el('tr'); tr.append(el('th', '', label, { scope: 'row' }), el('td', '', `${count(value?.detected_events)} of ${count(value?.actual_events)}`),
          el('td', '', count(value?.false_alert_days)), el('td', '', count(value?.missed_events))); return tr;
      });
      node.append(table('Exploratory interruption test · false-alert days are quote-day decisions', ['Signal', 'Events detected', 'False-alert days', 'Events missed'], rows),
        el('p', 'gas-section-note', `${count(performance.decision_days)} quote-day decisions. Multiple alert days may relate to one event; they do not count as independent interruptions.`));
      const unresolvedTargets = [performance.early?.unresolved_target_dates, performance.sustained?.unresolved_target_dates];
      const unresolvedDays = [performance.early?.unresolved_alert_days, performance.sustained?.unresolved_alert_days];
      node.append(el('p', 'gas-section-note', `Unresolved target dates, early / sustained: ${unresolvedTargets.map(count).join(' / ')}. Unresolved alert days: ${unresolvedDays.map(count).join(' / ')}.`));
    } else node.append(el('p', 'gas-section-note', 'Watch validation is unavailable.'));
    return node;
  }
  function ledgerSection(at) {
    const node = section('Predictions vs actual prices', 'First and latest saved estimates for the most recent 26 effective dates. Updates to the same date stay one event.', 'gas-ledger');
    node.id = 'gas-results';
    const groups = groupForecasts(data?.issued_forecasts, at);
    const observed = groups.filter((group) => group.status === 'scored').length; const pending = groups.length - observed;
    node.append(el('p', 'gas-ledger-summary', `Recent history · ${observed} effective ${observed === 1 ? 'date' : 'dates'} scored · ${pending} awaiting an official outcome`));
    const comparison = el('figure', 'gas-comparison');
    const controls = el('div', 'gas-comparison-controls');
    const choice = el('select', 'gas-comparison-select', null, { id: 'gas-comparison-issue' });
    choice.append(el('option', '', 'First saved prediction', { value: 'first' }), el('option', '', 'Latest saved prediction', { value: 'latest' }));
    choice.value = comparisonIssue; choice.disabled = observed === 0;
    controls.append(el('label', '', 'Prediction to compare', { for: 'gas-comparison-issue' }), choice);
    const plot = el('div', 'gas-comparison-body');
    const draw = () => renderComparison(plot, forecastComparison(data?.issued_forecasts, zone, comparisonIssue, at), { document, zone, issue: comparisonIssue });
    choice.addEventListener('change', () => {
      if (!['first', 'latest'].includes(choice.value)) return;
      comparisonIssue = choice.value; draw();
    });
    draw();
    comparison.append(controls, el('figcaption', 'gas-comparison-explanation', 'Zero means an exact match. Above zero is too high; below zero is too low. Pending dates enter the graph only after the official outcome is known.'), plot);
    node.append(comparison);
    if (!groups.length) {
      node.append(el('p', 'gas-section-note', 'No valid pre-setting records are available in this snapshot. Historical test scores above do not establish prospective accuracy.')); return node;
    }
    function issues(group, error = false) {
      const cell = el('td');
      group.records.forEach((record, index) => {
        const issue = el('div', 'gas-issue');
        const predicted = selected(record.predicted_zones)?.minimum; const actual = selected(group.score?.zones)?.actual_minimum;
        const label = group.records.length === 1 ? 'Saved' : index === 0 ? 'First' : 'Latest';
        const value = error ? actual ? formatCents(String(decimal(predicted) - decimal(actual)), { signed: true }) : 'Pending' : formatPrice(predicted);
        issue.append(el('span', 'gas-issue-label', label), el('span', '', value));
        if (!error) issue.append(el('span', 'gas-issue-time', formatTimestamp(record.issued_at)));
        cell.append(issue);
      }); return cell;
    }
    const rows = groups.map((group) => {
      const tr = el('tr', 'gas-ledger-event');
      const actual = selected(group.score?.zones)?.actual_minimum;
      tr.append(el('th', '', formatDate(group.date), { scope: 'row' }), issues(group), el('td', '', actual ? formatPrice(actual) : 'Pending'), issues(group, true)); return tr;
    });
    node.append(table(`Zone ${zone} · minimum price in CAD per litre · error = estimate minus official`, ['Effective date', 'Saved estimate', 'Official outcome', 'Error'], rows));
    return node;
  }
  function sourcesSection() {
    const node = section('Sources and updates', 'Official orders set the price. Public market quotes support the conditional estimate.', 'gas-sources');
    const list = el('ul', 'gas-source-list'); const seen = new Set();
    for (const item of Array.isArray(data?.sources) ? data.sources : []) {
      const url = publicUrl(item?.url);
      if (!url || seen.has(url) || typeof item.name !== 'string') continue;
      seen.add(url); const li = el('li'); li.append(link(item.name, url)); list.append(li);
    }
    if (!seen.has(BOARD_URL)) { const li = el('li'); li.append(link('Nova Scotia Energy Board prices and zone map', BOARD_URL)); list.append(li); }
    node.append(list, el('p', 'gas-section-note', 'The hosted updater checks sources hourly. This page checks the public feed every five minutes while open. Estimates and watch are hidden after a source check is three hours old, at the Friday setting time, or when a fresh official anchor is missing. Dates and times use Atlantic time.'));
    return node;
  }
  function render() {
    const at = now(); const view = assessSnapshot(data, at); lastReason = view.reason;
    const feedLabel = source === 'bootstrap' ? 'Live feed unavailable. Using a saved snapshot. ' : source === 'last_received' ? 'Live feed unavailable. Using the last received snapshot. ' : '';
    feedStatus.textContent = `${feedLabel}${view.reason ? messages[view.reason] : 'Source check is current. Friday estimates remain conditional.'}${view.checkedAt ? ` Last checked ${formatTimestamp(view.checkedAt)}.` : ''}`;
    feedStatus.setAttribute('data-state', view.reason || source !== 'live' ? 'withheld' : 'fresh');
    const summary = el('section', 'gas-summary', null, { 'aria-label': `Zone ${zone} regular self-service gasoline prices` });
    const prices = el('div', 'gas-price-grid'); prices.append(currentCard(view), estimateCard(view));
    summary.append(prices, allZones(view));
    const keepComparisonFocus = document.activeElement?.id === 'gas-comparison-issue';
    content.replaceChildren(summary, ledgerSection(at), performanceSection(), watchSection(view), sourcesSection());
    if (keepComparisonFocus) content.querySelector('#gas-comparison-issue')?.focus({ preventScroll: true });
  }
  async function refresh() {
    if (busy) return;
    busy = true; refreshButton.disabled = true; refreshButton.textContent = 'Checking…'; lastFetch = now().getTime();
    try {
      const result = await loadSnapshot(fetcher);
      if (data && result.source !== 'live' && (!result.snapshot || Date.parse(result.snapshot.checked_at) < Date.parse(data.checked_at))) source = 'last_received';
      else { data = result.snapshot; source = result.source; }
      render();
    } finally { busy = false; refreshButton.disabled = false; refreshButton.textContent = 'Check for updates'; }
  }
  function checkTime() {
    if (assessSnapshot(data, now()).reason !== lastReason) render();
    if (window && document.visibilityState !== 'hidden' && now().getTime() - lastFetch >= 5 * 60 * 1000) void refresh();
  }
  select.addEventListener('change', () => { zone = Number(select.value); if (zone >= 1 && zone <= 6) render(); });
  refreshButton.addEventListener('click', () => { checkTime(); void refresh(); });
  document.addEventListener('visibilitychange', checkTime);
  let timer = window?.setInterval(checkTime, 1000);
  window?.addEventListener('pagehide', () => {
    window.clearInterval(timer); timer = null;
    document.removeEventListener('visibilitychange', checkTime);
  });
  window?.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    checkTime();
    if (timer === null) {
      document.addEventListener('visibilitychange', checkTime);
      timer = window.setInterval(checkTime, 1000);
    }
  });
  const ready = refresh();
  return { ready };
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('#gas-app');
  if (root) mountGasWatch(root);
}
