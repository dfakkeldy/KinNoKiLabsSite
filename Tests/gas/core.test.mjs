import test from 'node:test';
import assert from 'node:assert/strict';

import * as core from '../../Resources/gas/gas-core.js';

const now = new Date('2026-10-15T23:00:00Z');
const zones = (minimum = '194.8', maximum = '197.8') =>
  Array.from({ length: 6 }, (_, index) => ({ zone: index + 1, minimum, maximum }));
function snapshot() {
  return {
    schema_version: 1, checked_at: '2026-10-15T22:45:00Z', status: 'ok', error: null,
    current: { date: '2026-10-09', source_url: 'https://nserbt.ca/prices.pdf',
      benchmark: '124.12', forward: '0', clean_fuel: '10.13', credit_card: '0.90', zones: zones() },
    target_date: '2026-10-16',
    estimate: { date: '2026-10-16', mode: 'provisional', zones: zones('191.2', '194.2'),
      issued_at: '2026-10-15T22:00:00Z', model_version: 'rolling-v3', observed_quotes: 3,
      total_quotes: 5, projected_quotes: 2, latest_quote_date: '2026-10-14',
      error_reference: '6.7', outside_training_features: [], assumptions: ['Remaining quotes hold the last observed value.'] },
    watch: { status: 'below_reference', latest_gap: '-3.18', reference_cents: '6', direction: null,
      observations: [{ date: '2026-10-14', supply_gap: '-3.53' }, { date: '2026-10-15', supply_gap: '-3.18' }],
      regular_setting_next: true, limitations: 'Uses different inputs from the Board.', source_url: 'https://nserbt.ca/interruption.pdf' },
    performance: { complete: { count: 18, mae: '1.64', max_error: '4.1' },
      rolling: [{ lead_days: 7, count: 15, total: 15, mae: '4.89', max_error: '14.0', earlier_p90: '5.9' },
        { lead_days: 1, count: 15, total: 15, mae: '1.69', max_error: '4.1', earlier_p90: '2.8' }],
      watch: { decision_days: 57, early: { actual_events: 3, detected_events: 2, false_alert_days: 5, missed_events: 1, unresolved_target_dates: 0, unresolved_alert_days: 0 },
        sustained: { actual_events: 3, detected_events: 0, false_alert_days: 2, missed_events: 3, unresolved_target_dates: 0, unresolved_alert_days: 0 } } },
    issued_forecasts: [], live_validation: { observed_events: 0, pending_events: 0 },
    sources: [{ name: 'Nova Scotia Energy Board', url: 'https://nserbt.ca/prices.pdf' }],
  };
}

function assess(value, at = now) {
  assert.equal(typeof core.assessSnapshot, 'function', 'A snapshot must have a freshness and validation boundary');
  return core.assessSnapshot(value, at);
}

test('a fresh conditional estimate retains all six official and estimated prices', () => {
  const view = assess(snapshot());
  assert.equal(view.reason, null);
  assert.equal(view.current.zones[5].minimum, '194.8');
  assert.equal(view.estimate.zones[5].minimum, '191.2');
  assert.equal(view.watch.latest_gap, '-3.18');
});

test('a diesel-only order preserves the gasoline anchor and preceding real watch quotes', () => {
  const data = snapshot();
  data.checked_at = '2026-09-12T15:00:00Z';
  data.current.date = '2026-09-12';
  data.current.gasoline_setting = false;
  data.current.gasoline_setting_date = '2026-09-11';
  data.target_date = data.estimate.date = '2026-09-18';
  data.estimate.issued_at = '2026-09-12T14:00:00Z';
  data.estimate.latest_quote_date = '2026-09-11';
  data.watch.anchor_date = '2026-09-11';
  data.watch.observations = [{ date: '2026-09-11', supply_gap: '-3.18' }];
  const view = assess(data, new Date('2026-09-12T15:10:00Z'));
  assert.equal(view.reason, null);
  assert.equal(view.current.date, '2026-09-12');
  assert.equal(view.watch?.anchor_date, '2026-09-11');
  data.watch.anchor_date = '2026-09-04';
  assert.equal(assess(data, new Date('2026-09-12T15:10:00Z')).watch, null);
});

test('assumptions and outside-training features remain visible without hiding a valid price', () => {
  const data = snapshot();
  data.estimate.outside_training_features = ['A supply change outside the training range'];
  assert.equal(assess(data).estimate.zones[5].minimum, '191.2');
});

test('three hours is allowed but one millisecond older withholds estimate and watch', () => {
  const data = snapshot();
  data.checked_at = '2026-10-15T20:00:00Z';
  data.estimate.issued_at = '2026-10-15T19:00:00Z';
  assert.ok(assess(data).estimate);
  const stale = assess(data, new Date('2026-10-15T23:00:00.001Z'));
  assert.equal(stale.reason, 'stale');
  assert.equal(stale.estimate, null);
  assert.equal(stale.watch, null);
  assert.equal(stale.current.zones[5].minimum, '194.8');
});

test('an updater error retains official prices and never serves its estimate', () => {
  const data = snapshot(); data.status = 'error'; data.error = 'Official source unavailable';
  const view = assess(data);
  assert.equal(view.reason, 'feed_error');
  assert.ok(view.current);
  assert.equal(view.estimate, null);
  assert.equal(view.watch, null);
});

test('Friday expiry follows 00:01 Halifax in summer and winter, including the last valid minute', () => {
  assert.equal(core.effectiveAt?.('2026-10-16'), Date.parse('2026-10-16T03:01:00Z'));
  assert.equal(core.effectiveAt?.('2026-03-06'), Date.parse('2026-03-06T04:01:00Z'));
  assert.equal(core.effectiveAt?.('2026-03-13'), Date.parse('2026-03-13T03:01:00Z'));
  const data = snapshot(); data.checked_at = '2026-10-16T02:59:00Z';
  assert.ok(assess(data, new Date('2026-10-16T03:00:59.999Z')).estimate);
  const expired = assess(data, new Date('2026-10-16T03:01:00Z'));
  assert.equal(expired.reason, 'expired');
  assert.equal(expired.estimate, null);
  assert.equal(expired.watch, null);
});

test('the next week cannot start with the previous Friday official anchor', () => {
  const data = snapshot(); data.checked_at = '2026-10-16T12:00:00Z';
  data.target_date = data.estimate.date = '2026-10-23';
  data.estimate.issued_at = '2026-10-16T11:30:00Z';
  const view = assess(data, new Date('2026-10-16T12:10:00Z'));
  assert.equal(view.reason, 'official_pending');
  assert.equal(view.estimate, null);
  assert.equal(view.watch, null);
  data.current.date = '2026-10-16';
  assert.ok(assess(data, new Date('2026-10-16T12:10:00Z')).estimate);
});

test('unknown schema, invalid dates and missing official zone data fail closed', () => {
  const wrongSchema = snapshot(); wrongSchema.schema_version = 2;
  assert.equal(assess(wrongSchema).current, null);
  const invalidDate = snapshot(); invalidDate.current.date = '2026-02-30';
  assert.equal(assess(invalidDate).current, null);
  const missingZone = snapshot(); missingZone.current.zones.pop();
  assert.equal(assess(missingZone).estimate, null);
  assert.equal(assess(missingZone).current, null);
  assert.equal(assess(null).estimate, null);
});

test('future timestamps and future official values cannot look current', () => {
  const futureCheck = snapshot(); futureCheck.checked_at = '2026-10-15T23:00:01Z';
  assert.equal(assess(futureCheck).reason, 'future_data');
  const futureIssue = snapshot(); futureIssue.estimate.issued_at = '2026-10-16T00:00:00Z';
  assert.equal(assess(futureIssue).estimate, null);
  const futureCurrent = snapshot(); futureCurrent.current.date = '2026-10-16';
  assert.equal(assess(futureCurrent).current, null);
});

test('wrong Friday, target mismatch, numeric prices and impossible quote coverage withhold the estimate', () => {
  for (const change of [
    (data) => { data.target_date = data.estimate.date = '2026-10-23'; },
    (data) => { data.target_date = data.estimate.date = '2026-10-17'; },
    (data) => { data.estimate.date = '2026-10-23'; },
    (data) => { data.estimate.zones[5].minimum = 191.2; },
    (data) => { data.estimate.zones[5].maximum = '190.0'; },
    (data) => { data.estimate.observed_quotes = 6; },
    (data) => { data.estimate.latest_quote_date = '2026-10-20'; },
  ]) {
    const data = snapshot(); change(data);
    const view = assess(data);
    assert.equal(view.estimate, null);
    assert.ok(view.current);
  }
});

test('missing predictions preserve official values and an invalid watch never becomes a signal', () => {
  const data = snapshot(); data.estimate = null;
  assert.ok(assess(data).current);
  assert.equal(assess(data).estimate, null);
  data.watch.observations[0].date = '2026-10-20';
  assert.equal(assess(data).watch, null);
});

test('a watch cannot reuse an old anchor, duplicate a quote day, or contradict its latest observation', () => {
  for (const change of [
    (data) => { data.watch.anchor_date = '2026-10-02'; },
    (data) => { data.watch.observations[1].date = '2026-10-14'; },
    (data) => { data.watch.latest_gap = '6.5'; },
    (data) => { data.watch.latest_gap = null; },
  ]) {
    const value = snapshot(); change(value);
    assert.equal(assess(value).watch === null, true);
    assert.ok(assess(value).estimate);
  }
});

test('price formatting converts cents to three decimal dollar amounts without accepting numeric JSON', () => {
  assert.equal(core.formatPrice?.('194.8'), '$1.948');
  assert.equal(core.formatPrice?.('0'), '$0.000');
  assert.equal(core.formatPrice?.('194.85'), '$1.949');
  assert.equal(core.formatPrice?.('garbage'), 'Unavailable');
  assert.equal(core.formatPrice?.(194.8), 'Unavailable');
  assert.equal(core.formatCents?.('-3.6', { signed: true }), '-3.6¢/L');
});

test('one effective date stays one ledger event with the earliest and latest distinct issues', () => {
  const record = (id, issued, status = 'pending') => ({ record_id: id, date: '2026-10-09',
    issued_at: issued, model_version: 'v2', predicted_zones: zones('191.2', '194.2'), status,
    zones: status === 'scored' ? zones().map((zone) => ({ zone: zone.zone, predicted_minimum: '191.2', actual_minimum: '194.8', minimum_error: '-3.6' })) : undefined });
  const first = record('a', '2026-10-07T12:00:00Z');
  const middle = record('b', '2026-10-08T12:00:00Z');
  const latest = record('c', '2026-10-08T20:00:00Z', 'scored');
  const groups = core.groupForecasts?.([latest, first, middle, { ...first }], now);
  assert.equal(groups?.length, 1);
  assert.equal(groups[0].records.length, 2);
  assert.equal(groups[0].records[0].record_id, 'a');
  assert.equal(groups[0].records[1].record_id, 'c');
  assert.equal(groups[0].status, 'scored');
});

test('ledger records issued after their effective date or with future scores do not establish live success', () => {
  const records = [{ record_id: 'late', date: '2026-10-09', issued_at: '2026-10-10T12:00:00Z',
    model_version: 'v2', predicted_zones: zones(), status: 'scored', zones: [] },
    { record_id: 'future', date: '2026-10-16', issued_at: '2026-10-15T22:00:00Z',
      model_version: 'v2', predicted_zones: zones(), status: 'scored', zones: [] }];
  assert.deepEqual(core.groupForecasts?.(records, now), []);
});

test('a live error snapshot is retained rather than replaced by a successful bootstrap', async () => {
  const data = snapshot(); data.status = 'error';
  let calls = 0;
  const result = await core.loadSnapshot?.(async () => { calls += 1; return { ok: true, json: async () => data }; });
  assert.equal(result?.source, 'live');
  assert.equal(result.snapshot.status, 'error');
  assert.equal(calls, 1);
});

test('network failure falls back to a snapshot whose own expiry is still enforced', async () => {
  const urls = []; const data = snapshot(); data.checked_at = '2026-10-15T10:00:00Z';
  const result = await core.loadSnapshot?.(async (url, options) => {
    urls.push(url);
    assert.equal(options.credentials, 'omit');
    if (urls.length === 1) throw new Error('offline');
    return { ok: true, json: async () => data };
  });
  assert.equal(result?.source, 'bootstrap');
  assert.deepEqual(urls, ['https://raw.githubusercontent.com/dfakkeldy/KinNoKiLabsSite/gas-price-watch-data/latest.json', './bootstrap.json']);
  assert.equal(assess(result.snapshot).estimate, null);
});
