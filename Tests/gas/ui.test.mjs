import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture } from '../games/dom-fixture.mjs';

import * as ui from '../../Resources/gas/gas.js';
const prices = (min = '194.8', max = '197.8') => Array.from({ length: 6 }, (_, index) => ({ zone: index + 1, minimum: min, maximum: max }));
function data() {
  return {
    schema_version: 1, checked_at: '2026-10-15T22:45:00Z', status: 'ok', error: null,
    current: { date: '2026-10-09', source_url: 'https://nserbt.ca/prices.pdf', zones: prices(), benchmark: '124.12', forward: '0', clean_fuel: '10.13', credit_card: '0.90' },
    target_date: '2026-10-16', estimate: { date: '2026-10-16', mode: 'provisional', zones: prices('191.2', '194.2'), issued_at: '2026-10-15T22:00:00Z', model_version: 'rolling-v3',
      observed_quotes: 3, total_quotes: 5, projected_quotes: 2, latest_quote_date: '2026-10-14', error_reference: '6.7', outside_training_features: [], assumptions: ['Remaining weekdays hold the last real quote.'] },
    watch: { status: 'below_reference', latest_gap: '-3.18', reference_cents: '6', direction: null, observations: [{ date: '2026-10-14', supply_gap: '-3.53' }, { date: '2026-10-15', supply_gap: '-3.18' }], regular_setting_next: true, limitations: 'The Board uses different inputs and discretion.', source_url: 'https://nserbt.ca/interruption.pdf' },
    performance: { complete: { count: 18, mae: '1.64', max_error: '4.1' }, rolling: [{ lead_days: 7, count: 15, total: 15, mae: '4.89', max_error: '14.0', earlier_p90: '5.9' }, { lead_days: 1, count: 15, total: 15, mae: '1.69', max_error: '4.1', earlier_p90: '2.8' }],
      watch: { decision_days: 57, early: { actual_events: 3, detected_events: 2, false_alert_days: 5, missed_events: 1, unresolved_target_dates: 0, unresolved_alert_days: 0 }, sustained: { actual_events: 3, detected_events: 0, false_alert_days: 2, missed_events: 3, unresolved_target_dates: 0, unresolved_alert_days: 0 } } },
    issued_forecasts: [], live_validation: { observed_events: 0, pending_events: 0 }, sources: [{ name: 'Nova Scotia Energy Board', url: 'https://nserbt.ca/prices.pdf' }],
  };
}
async function mount(snapshot, { at = '2026-10-15T23:00:00Z', fetcher } = {}) {
  assert.equal(typeof ui.mountGasWatch, 'function', 'The public page must mount a usable view');
  const fixture = createDOMFixture(); let clock = new Date(at);
  const calls = [];
  const app = ui.mountGasWatch(fixture.root, { document: fixture.document, window: fixture.window, now: () => clock,
    fetcher: fetcher || (async (url) => { calls.push(url); return { ok: true, json: async () => snapshot }; }) });
  await app.ready;
  return { ...fixture, app, calls, setTime: (value) => { clock = new Date(value); } };
}
const settle = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };

test('the first view selects Zone 6 with official dollars, a conditional estimate and quote coverage', async () => {
  const fixture = await mount(data());
  const select = fixture.root.querySelector('select');
  assert.equal(select.value, '6');
  assert.equal(select.querySelectorAll('option').length, 6);
  assert.match(fixture.root.querySelector(`label[for=${select.id}]`).textContent, /pricing zone/i);
  assert.equal(fixture.root.querySelector('.gas-current-price').textContent, '$1.948');
  assert.equal(fixture.root.querySelector('.gas-estimate-price').textContent, '$1.912');
  assert.match(fixture.root.querySelector('.gas-coverage').textContent, /3 of 5.*2.*assumed/i);
  assert.match(fixture.root.textContent, /regular.*self-service/i);
  assert.match(fixture.root.textContent, /CAD.*litre/i);
  assert.match(fixture.root.textContent, /Oct 9, 2026/);
});

test('zone changes update displayed values without changing the feed URL or losing the selector focus', async () => {
  const snapshot = data(); snapshot.current.zones[0] = { zone: 1, minimum: '192.9', maximum: '195.8' };
  snapshot.estimate.zones[0] = { zone: 1, minimum: '189.3', maximum: '192.2' };
  const fixture = await mount(snapshot);
  const select = fixture.root.querySelector('select'); select.focus(); select.value = '1';
  select.dispatchEvent(new fixture.Event('change'));
  assert.equal(fixture.root.querySelector('.gas-current-price').textContent, '$1.929');
  assert.equal(fixture.root.querySelector('.gas-estimate-price').textContent, '$1.893');
  assert.equal(fixture.document.activeElement, select);
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].includes('?'), false);
});

test('the open page removes forecast and watch at the Halifax setting minute', async () => {
  const snapshot = data(); snapshot.checked_at = '2026-10-16T02:59:00Z';
  const fixture = await mount(snapshot, { at: '2026-10-16T03:00:59Z' });
  assert.ok(fixture.root.querySelector('.gas-estimate-price'));
  fixture.setTime('2026-10-16T03:01:00Z'); fixture.tickIntervals();
  assert.equal(fixture.root.querySelector('.gas-estimate-price'), null);
  assert.equal(fixture.root.querySelector('.gas-watch-gap'), null);
  assert.ok(fixture.root.querySelector('.gas-current-price'));
  assert.match(fixture.root.querySelector('.gas-feed-status').textContent, /expired|official order/i);
});

test('returning to a background tab rechecks freshness before showing a headline', async () => {
  const fixture = await mount(data());
  fixture.document.visibilityState = 'hidden';
  fixture.setTime('2026-10-16T01:45:00.001Z');
  fixture.document.visibilityState = 'visible';
  fixture.document.dispatchEvent(new fixture.Event('visibilitychange'));
  assert.equal(fixture.root.querySelector('.gas-estimate-price'), null);
  assert.equal(fixture.root.querySelector('.gas-watch-gap'), null);
  assert.match(fixture.root.querySelector('.gas-feed-status').textContent, /three hours|3 hours/i);
});

test('a stale bootstrap is labelled and cannot revive an expired forecast after a network failure', async () => {
  const snapshot = data(); let calls = 0;
  const fixture = await mount(snapshot, { at: '2026-10-16T12:00:00Z', fetcher: async () => {
    calls += 1; if (calls === 1) throw new Error('offline');
    return { ok: true, json: async () => snapshot };
  } });
  assert.equal(fixture.root.querySelector('.gas-estimate-price'), null);
  assert.equal(fixture.root.querySelector('.gas-watch-gap'), null);
  assert.match(fixture.root.querySelector('.gas-feed-status').textContent, /saved snapshot/i);
  assert.ok(fixture.root.querySelector('.gas-current-price'));
});

test('historical errors distinguish early and late tests and make watch false alarms visible', async () => {
  const fixture = await mount(data());
  const performance = fixture.root.querySelector('.gas-performance');
  assert.match(performance.textContent, /18.*1\.64|1\.64.*18/);
  assert.match(performance.textContent, /7 days.*4\.89|4\.89.*7 days/);
  assert.match(performance.textContent, /1 day.*1\.69|1\.69.*1 day/);
  assert.match(performance.textContent, /14\.0/);
  const watch = fixture.root.querySelector('.gas-watch');
  assert.match(watch.textContent, /Experimental/);
  assert.match(watch.textContent, /57 quote-day/);
  const rows = watch.querySelectorAll('tbody tr');
  assert.match(rows[0].textContent, /2 of 3/);
  assert.match(rows[0].textContent, /5/);
  assert.match(rows[1].textContent, /0 of 3/);
  assert.match(rows[1].textContent, /2/);
  assert.match(watch.textContent, /NYH/);
  assert.match(watch.textContent, /false-alert days/i);
});

test('several issues for one date produce one observed event with first, latest and actual prices', async () => {
  const snapshot = data();
  const record = (id, time, minimum) => ({ record_id: id, date: '2026-10-09', issued_at: time, model_version: 'v2', status: 'scored', predicted_zones: prices(minimum, '197.8'),
    zones: prices().map((zone) => ({ zone: zone.zone, predicted_minimum: minimum, actual_minimum: '194.8', minimum_error: '-3.6' })) });
  const first = record('first', '2026-10-07T12:00:00Z', '193.1');
  const latest = record('latest', '2026-10-08T21:00:00Z', '191.2');
  snapshot.issued_forecasts = [latest, first, { ...first }];
  snapshot.live_validation.observed_events = 3;
  const fixture = await mount(snapshot);
  assert.equal(fixture.root.querySelectorAll('.gas-ledger-event').length, 1);
  const ledger = fixture.root.querySelector('.gas-ledger');
  assert.match(ledger.textContent, /1 effective date scored/);
  assert.match(ledger.textContent, /First.*\$1\.931/);
  assert.match(ledger.textContent, /Latest.*\$1\.912/);
  assert.match(ledger.textContent, /\$1\.948/);
  assert.match(ledger.textContent, /-1\.7¢\/L/);
  assert.match(ledger.textContent, /-3\.6¢\/L/);
});

test('data text is rendered as text and unsafe source URLs never become links', async () => {
  const snapshot = data();
  snapshot.estimate.assumptions = ['<img src=x onerror=alert(1)>'];
  snapshot.estimate.outside_training_features = ['Unusual market change'];
  snapshot.sources.push({ name: '<script>alert(1)</script>', url: 'javascript:alert(1)' });
  snapshot.sources.push({ name: '<b>Public source</b>', url: 'https://example.com/public' });
  const fixture = await mount(snapshot);
  assert.equal(fixture.root.querySelectorAll('img').length, 0);
  assert.equal(fixture.root.querySelectorAll('script').length, 0);
  assert.match(fixture.root.textContent, /<img src=x/);
  assert.match(fixture.root.textContent, /Unusual market change/);
  assert.ok(fixture.root.querySelector('.gas-estimate-price'));
  assert.equal(fixture.root.querySelectorAll('a').some((link) => link.getAttribute('href')?.startsWith('javascript:')), false);
});

test('total feed failure and missing performance remain readable without NaN or fabricated numbers', async () => {
  const fixture = await mount(null, { fetcher: async () => { throw new Error('offline'); } });
  assert.equal(fixture.root.querySelector('.gas-current-price'), null);
  assert.equal(fixture.root.querySelector('.gas-estimate-price'), null);
  assert.match(fixture.root.textContent, /unavailable/i);
  assert.equal(/NaN|undefined/.test(fixture.root.textContent), false);
  const snapshot = data(); delete snapshot.performance;
  const partial = await mount(snapshot);
  assert.ok(partial.root.querySelector('.gas-current-price'));
  assert.match(partial.root.querySelector('.gas-performance').textContent, /unavailable/i);
});

test('manual and scheduled refresh use the same public feed and page exit stops its timer', async () => {
  const fixture = await mount(data());
  fixture.root.querySelector('.gas-refresh').click(); await settle();
  assert.equal(fixture.calls.length, 2);
  fixture.setTime('2026-10-15T23:05:01Z'); fixture.tickIntervals(); await settle();
  assert.equal(fixture.calls.length, 3);
  assert.equal(new Set(fixture.calls).size, 1);
  fixture.window.dispatchEvent(new fixture.Event('pagehide'));
  assert.equal(fixture.activeIntervalCount(), 0);
});

test('browser back-cache restoration immediately expires an old headline and restarts time checks', async () => {
  const snapshot = data(); snapshot.checked_at = '2026-10-16T02:59:00Z';
  const fixture = await mount(snapshot, { at: '2026-10-16T03:00:00Z' });
  fixture.window.dispatchEvent(new fixture.Event('pagehide', { persisted: true }));
  fixture.setTime('2026-10-16T03:01:00Z');
  fixture.window.dispatchEvent(new fixture.Event('pageshow', { persisted: true }));
  assert.equal(Boolean(fixture.root.querySelector('.gas-estimate-price')), false);
  assert.equal(Boolean(fixture.root.querySelector('.gas-watch-gap')), false);
  assert.equal(fixture.activeIntervalCount(), 1);
});
