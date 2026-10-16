import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastComparison, comparisonLimit } from '../../Resources/gas/gas-chart.js';

const now = new Date('2026-10-16T08:00:00Z');
function record(id, { date = '2026-10-09', issued = '2026-10-08T18:00:00Z', predicted = '191.2', actual = '192.1', status = 'scored' } = {}) {
  const zones = Array.from({ length: 6 }, (_, i) => ({ zone: i + 1,
    minimum: (Number(predicted) + (i - 5) * 0.5).toFixed(1), maximum: (Number(predicted) + (i - 5) * 0.5 + 3).toFixed(1) }));
  return { record_id: id, date, issued_at: issued, status, predicted_zones: zones,
    zones: zones.map((z) => ({ zone: z.zone, predicted_minimum: z.minimum,
      actual_minimum: (Number(actual) + (z.zone - 6) * 0.5).toFixed(1), minimum_error: '999' })) };
}

test('first and latest comparisons use one official outcome per date and calculate the signed error', () => {
  const rows = [record('latest', { issued: '2026-10-08T22:00:00Z', predicted: '192.4' }), record('first')];
  const first = forecastComparison(rows, 6, 'first', now);
  const latest = forecastComparison(rows, 6, 'latest', now);
  assert.equal(first.length, 1);
  assert.equal(first[0].predicted, '191.2');
  assert.equal(first[0].actual, '192.1');
  assert.equal(first[0].error, -0.9);
  assert.equal(latest[0].error, 0.3);
  assert.equal(latest[0].recordId, 'latest');
  assert.equal(forecastComparison(rows, 1, 'first', now)[0].predicted, '188.7');
});

test('pending, future, late-issued and invalid records never become plotted zero errors', () => {
  const rows = [record('pending', { date: '2026-10-23', issued: '2026-10-16T04:00:00Z', status: 'pending' }),
    record('future', { date: '2026-10-23', issued: '2026-10-16T04:00:00Z' }),
    record('late', { date: '2026-10-16', issued: '2026-10-16T03:02:00Z' })];
  const invalid = record('invalid'); invalid.zones.pop(); rows.push(invalid);
  assert.deepEqual(forecastComparison(rows, 6, 'first', now), []);
});

test('completed dates are chronological and an exact match remains a genuine zero', () => {
  const rows = [record('second', { date: '2026-10-16', issued: '2026-10-15T18:00:00Z', predicted: '192.1' }), record('first')];
  const points = forecastComparison(rows, 6, 'first', now);
  assert.deepEqual(points.map((p) => p.date), ['2026-10-09', '2026-10-16']);
  assert.equal(points[1].error, 0);
  assert.equal(Object.is(points[1].error, -0), false);
});

test('the symmetric scale has a readable minimum and contains a large miss without clipping', () => {
  assert.equal(comparisonLimit([{ error: -0.9 }]), 5);
  assert.equal(comparisonLimit([{ error: 14 }, { error: -12.5 }]), 15);
  assert.equal(comparisonLimit([{ error: 0 }]), 5);
});
