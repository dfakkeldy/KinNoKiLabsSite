import { decimal, formatCents, formatDate, formatPrice, groupForecasts } from './gas-core.js';

export function forecastComparison(records, zone, issue = 'first', now = new Date()) {
  if (!Number.isInteger(zone) || zone < 1 || zone > 6 || !['first', 'latest'].includes(issue)) return [];
  return groupForecasts(records, now).filter((group) => group.score).reverse().map((group) => {
    const saved = issue === 'latest' ? group.records.at(-1) : group.records[0];
    const predicted = saved.predicted_zones.find((row) => row.zone === zone).minimum;
    const actual = group.score.zones.find((row) => row.zone === zone).actual_minimum;
    return { date: group.date, recordId: saved.record_id, issuedAt: saved.issued_at, predicted, actual,
      error: Number((decimal(predicted) - decimal(actual)).toFixed(1)) };
  });
}

export function comparisonLimit(points) {
  return Math.ceil(Math.max(5, ...points.map((point) => Math.abs(point.error))) / 5) * 5;
}

export function renderComparison(root, points, { document = root.ownerDocument, zone, issue }) {
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function svg(tag, attributes, text) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  root.replaceChildren();
  if (!points.length) {
    root.append(el('p', 'gas-comparison-empty', 'The graph will appear when a saved prediction has a verified official outcome. Pending dates are not plotted.'));
    return;
  }
  const newest = points.at(-1);
  const difference = newest.error === 0 ? 'Exact match.' : `${formatCents(String(Math.abs(newest.error)))} too ${newest.error > 0 ? 'high' : 'low'}.`;
  root.append(el('p', 'gas-comparison-result', `${formatDate(newest.date)}: estimated ${formatPrice(newest.predicted)}, official ${formatPrice(newest.actual)}. ${difference}`),
    el('p', 'gas-comparison-caption', `Zone ${zone} minimum price · ${points.length} completed ${points.length === 1 ? 'date' : 'dates'} · ${issue === 'latest' ? 'Latest' : 'First'} saved prediction`));

  const limit = comparisonLimit(points);
  const width = Math.max(240, points.length * 84);
  const frame = el('div', 'gas-comparison-frame');
  const axis = el('div', 'gas-comparison-axis'); axis.setAttribute('aria-hidden', 'true');
  axis.append(el('span', 'gas-comparison-unit', '¢/L'));
  const scroll = el('div', 'gas-comparison-scroll');
  scroll.setAttribute('tabindex', '0'); scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', 'Prediction error graph. Scroll horizontally for more dates.');
  const canvas = el('div', 'gas-comparison-canvas');
  const plot = svg('svg', { class: 'gas-comparison-svg', width, height: 200, viewBox: `0 0 ${width} 200`,
    preserveAspectRatio: 'none', role: 'img', 'aria-label': `Zone ${zone} ${issue} saved prediction errors in cents per litre. Zero is exact. Exact prices and errors are in the table below.` });
  plot.append(svg('desc', {}, 'Each bar is one completed price-setting date. Bars above zero overestimate the official price; bars below zero underestimate it. Pending outcomes are not plotted.'));
  for (let tick = 0; tick < 5; tick += 1) {
    const value = limit - tick * limit / 2;
    axis.append(el('span', `gas-comparison-tick gas-comparison-tick-${tick}`, value === 0 ? '0' : `${value > 0 ? '+' : ''}${value}`));
    plot.append(svg('line', { class: tick === 2 ? 'gas-comparison-zero' : 'gas-comparison-grid',
      x1: 0, x2: width, y1: tick * 50, y2: tick * 50, 'vector-effect': 'non-scaling-stroke' }));
  }
  const labels = el('div', 'gas-comparison-labels');
  for (const [index, point] of points.entries()) {
    const x = (index + 0.5) * width / points.length;
    const height = Math.abs(point.error) / limit * 100;
    const mark = point.error === 0
      ? svg('circle', { class: 'gas-comparison-exact', cx: x, cy: 100, r: 3, 'data-date': point.date })
      : svg('rect', { class: 'gas-comparison-bar', x: x - 12, y: point.error > 0 ? 100 - height : 100,
        width: 24, height, rx: 2, 'data-date': point.date, 'data-error': point.error });
    mark.append(svg('title', {}, `${formatDate(point.date)}: estimated ${formatPrice(point.predicted)}, official ${formatPrice(point.actual)}, error ${formatCents(String(point.error), { signed: true })}.`));
    plot.append(mark);
    const label = el('div', 'gas-comparison-point');
    label.append(el('span', 'gas-comparison-value', formatCents(String(point.error), { signed: true })), el('span', '', formatDate(point.date)));
    labels.append(label);
  }
  canvas.append(plot, labels); scroll.append(canvas); frame.append(axis, scroll); root.append(frame);
}
