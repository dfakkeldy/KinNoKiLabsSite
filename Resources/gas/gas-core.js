export const DATA_URL = 'https://raw.githubusercontent.com/dfakkeldy/KinNoKiLabsSite/gas-price-watch-data/latest.json';
const MAX_AGE = 3 * 60 * 60 * 1000;
const timeZone = 'America/Halifax';
const localParts = new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const dateLabel = new Intl.DateTimeFormat('en-CA', { timeZone, month: 'short', day: 'numeric', year: 'numeric' });
const timestampLabel = new Intl.DateTimeFormat('en-CA', {
  timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
});

function parts(at) {
  return Object.fromEntries(localParts.formatToParts(at).map(({ type, value }) => [type, value]));
}
function localDate(at) {
  const value = parts(at);
  return `${value.year}-${value.month}-${value.day}`;
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function timestamp(value) {
  if (typeof value !== 'string' || !validDate(value.slice(0, 10))) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|\+00:00)$/);
  if (!match || +match[1] > 23 || +match[2] > 59 || +match[3] > 59) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function decimal(value) {
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value) || value.length > 32) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function publicUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function validZones(zones) {
  return Array.isArray(zones) && zones.length === 6 && new Set(zones.map((zone) => zone?.zone)).size === 6 &&
    zones.every((zone) => Number.isInteger(zone?.zone) && zone.zone >= 1 && zone.zone <= 6 &&
      decimal(zone.minimum) !== null && decimal(zone.maximum) !== null &&
      decimal(zone.minimum) >= 0 && decimal(zone.maximum) >= decimal(zone.minimum));
}
function nonnegativeInteger(value) { return Number.isInteger(value) && value >= 0; }
function strings(value) { return Array.isArray(value) && value.every((item) => typeof item === 'string'); }
function addDays(date, days) {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
function gasolineDate(current) { return current.gasoline_setting_date ?? current.date; }

// Convert the Halifax wall-clock setting time to UTC, including its seasonal offset.
export function effectiveAt(date) {
  if (!validDate(date)) return null;
  const wallClock = Date.parse(`${date}T00:01:00Z`);
  let instant = wallClock;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const p = parts(new Date(instant));
    const localAsUTC = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    instant = wallClock - (localAsUTC - instant);
  }
  return instant;
}
function nextFriday(at) {
  const today = localDate(at);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  let days = (5 - weekday + 7) % 7;
  if (days === 0 && at.getTime() >= effectiveAt(today)) days = 7;
  return addDays(today, days);
}
function validEstimate(estimate, data, now, checked) {
  return estimate && estimate.date === data.target_date && validZones(estimate.zones) &&
    ['complete', 'provisional', 'extrapolation'].includes(estimate.mode) &&
    timestamp(estimate.issued_at) !== null && timestamp(estimate.issued_at) <= Math.min(now.getTime(), checked) &&
    typeof estimate.model_version === 'string' && estimate.model_version.length > 0 &&
    nonnegativeInteger(estimate.observed_quotes) && nonnegativeInteger(estimate.projected_quotes) &&
    Number.isInteger(estimate.total_quotes) && estimate.total_quotes > 0 &&
    estimate.observed_quotes + estimate.projected_quotes === estimate.total_quotes &&
    (estimate.mode !== 'complete' || estimate.projected_quotes === 0) &&
    validDate(estimate.latest_quote_date) && estimate.latest_quote_date <= localDate(now) &&
    estimate.latest_quote_date < estimate.date &&
    (estimate.error_reference === null || (decimal(estimate.error_reference) !== null && decimal(estimate.error_reference) >= 0)) &&
    strings(estimate.assumptions) && strings(estimate.outside_training_features);
}
function validWatch(watch, checked, current) {
  const active = ['below_reference', 'single_quote_move', 'sustained_proxy_move'].includes(watch?.status);
  const anchor = gasolineDate(current);
  return watch && ['below_reference', 'single_quote_move', 'sustained_proxy_move', 'waiting_for_quotes', 'unavailable'].includes(watch.status) &&
    (watch.latest_gap === null || decimal(watch.latest_gap) !== null) && decimal(watch.reference_cents) > 0 &&
    typeof watch.regular_setting_next === 'boolean' && typeof watch.limitations === 'string' && publicUrl(watch.source_url) &&
    (watch.anchor_date === undefined || watch.anchor_date === anchor) &&
    Array.isArray(watch.observations) && watch.observations.every((item, index) => validDate(item?.date) &&
      item.date <= localDate(checked) && item.date >= anchor && decimal(item.supply_gap) !== null &&
      (index === 0 || item.date > watch.observations[index - 1].date)) &&
    (!active || (watch.observations.length > 0 && watch.latest_gap !== null &&
      decimal(watch.latest_gap) === decimal(watch.observations.at(-1).supply_gap))) &&
    (watch.status !== 'sustained_proxy_move' || watch.observations.length >= 2);
}

export function assessSnapshot(data, now = new Date()) {
  const result = { current: null, estimate: null, watch: null, reason: 'invalid_data', checkedAt: null };
  if (!data || data.schema_version !== 1 || !Number.isFinite(now.getTime())) return result;
  const current = data.current;
  if (current && validDate(current.date) && publicUrl(current.source_url) && validZones(current.zones) &&
      validDate(gasolineDate(current)) && gasolineDate(current) <= current.date &&
      effectiveAt(current.date) <= now.getTime()) result.current = current;
  const checked = timestamp(data.checked_at);
  if (checked === null) return result;
  result.checkedAt = data.checked_at;
  if (data.status === 'error') return { ...result, reason: 'feed_error' };
  if (data.status !== 'ok') return result;
  if (checked > now.getTime()) return { ...result, reason: 'future_data' };
  if (now.getTime() - checked > MAX_AGE) return { ...result, reason: 'stale' };
  if (!result.current) return { ...result, reason: 'official_unavailable' };
  if (!validDate(data.target_date) || new Date(`${data.target_date}T12:00:00Z`).getUTCDay() !== 5) {
    return { ...result, reason: 'invalid_target' };
  }
  if (now.getTime() >= effectiveAt(data.target_date)) return { ...result, reason: 'expired' };
  const expected = nextFriday(now);
  if (gasolineDate(result.current) < addDays(expected, -7)) return { ...result, reason: 'official_pending' };
  if (data.target_date !== expected) return { ...result, reason: 'invalid_target' };
  if (data.estimate !== null && !validEstimate(data.estimate, data, now, checked)) {
    return { ...result, reason: 'invalid_estimate' };
  }
  return { ...result, estimate: data.estimate, watch: validWatch(data.watch, new Date(checked), result.current) ? data.watch : null, reason: null };
}

export function formatPrice(value) {
  if (decimal(value) === null || decimal(value) < 0) return 'Unavailable';
  const [whole, fraction = ''] = value.split('.');
  const mills = BigInt(whole) * 10n + BigInt(fraction[0] || 0) + (Number(fraction[1] || 0) >= 5 ? 1n : 0n);
  return `$${mills / 1000n}.${String(mills % 1000n).padStart(3, '0')}`;
}
export function formatCents(value, { signed = false, digits = 1 } = {}) {
  const number = decimal(value);
  if (number === null) return 'Unavailable';
  return `${signed && number > 0 ? '+' : ''}${number.toFixed(digits)}¢/L`;
}
export function formatDate(value) {
  return validDate(value) ? dateLabel.format(new Date(`${value}T12:00:00Z`)) : 'Date unavailable';
}
export function formatTimestamp(value) {
  return timestamp(value) !== null ? timestampLabel.format(new Date(value)) : 'Time unavailable';
}

function validScore(zones) {
  return Array.isArray(zones) && zones.length === 6 && new Set(zones.map((zone) => zone?.zone)).size === 6 &&
    zones.every((zone) => Number.isInteger(zone?.zone) && zone.zone >= 1 && zone.zone <= 6 &&
      decimal(zone.predicted_minimum) !== null && decimal(zone.predicted_minimum) >= 0 &&
      decimal(zone.actual_minimum) !== null && decimal(zone.actual_minimum) >= 0 && decimal(zone.minimum_error) !== null);
}
export function groupForecasts(records, now = new Date()) {
  const groups = new Map(); const seen = new Set();
  for (const record of Array.isArray(records) ? records : []) {
    if (!record || typeof record.record_id !== 'string' || seen.has(record.record_id) || !validDate(record.date) ||
        timestamp(record.issued_at) === null || timestamp(record.issued_at) > now.getTime() ||
        timestamp(record.issued_at) >= effectiveAt(record.date) || !validZones(record.predicted_zones) ||
        !['pending', 'scored'].includes(record.status) ||
        (record.status === 'scored' && (effectiveAt(record.date) > now.getTime() || !validScore(record.zones)))) continue;
    seen.add(record.record_id);
    const group = groups.get(record.date) || [];
    group.push(record); groups.set(record.date, group);
  }
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 26).map(([date, recordsForDate]) => {
    const ordered = recordsForDate.sort((a, b) => timestamp(a.issued_at) - timestamp(b.issued_at) || a.record_id.localeCompare(b.record_id));
    const score = ordered.findLast((record) => record.status === 'scored') || null;
    return { date, records: ordered.length === 1 ? ordered : [ordered[0], ordered.at(-1)], score, status: score ? 'scored' : 'pending' };
  });
}

export async function loadSnapshot(fetcher = globalThis.fetch) {
  for (const [source, url] of [['live', DATA_URL], ['bootstrap', './bootstrap.json']]) {
    try {
      const response = await fetcher(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
        ...(globalThis.AbortSignal?.timeout ? { signal: AbortSignal.timeout(12000) } : {}) });
      if (!response.ok) continue;
      const snapshot = await response.json();
      if (!snapshot || snapshot.schema_version !== 1) continue;
      return { snapshot, source };
    } catch { /* The fallback has exactly the same validation and expiry checks. */ }
  }
  return { snapshot: null, source: 'none' };
}
