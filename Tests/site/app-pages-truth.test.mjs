import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const echo = readFileSync(new URL('../../Content/apps/echo.md', import.meta.url), 'utf8');
const nsMarks = readFileSync(
  new URL('../../Content/apps/nsmarksthespot.md', import.meta.url),
  'utf8',
);
const visualTimer = readFileSync(
  new URL('../../Content/apps/visualtimer.md', import.meta.url),
  'utf8',
);
const echoBeta = readFileSync(new URL('../../Content/echo-beta.md', import.meta.url), 'utf8');
const nsMarksHelp = readFileSync(
  new URL('../../Content/nsmarksthespot-help.md', import.meta.url),
  'utf8',
);
const theme = readFileSync(
  new URL('../../Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift', import.meta.url),
  'utf8',
);
const generatedEcho = readFileSync(
  new URL('../../Output/apps/echo/index.html', import.meta.url),
  'utf8',
);
const generatedNsMarks = readFileSync(
  new URL('../../Output/apps/nsmarksthespot/index.html', import.meta.url),
  'utf8',
);
const generatedApps = readFileSync(
  new URL('../../Output/apps/index.html', import.meta.url),
  'utf8',
);

test('Echo public copy uses FSRS and drops the stale commit boast', () => {
  for (const source of [echo, theme]) {
    assert.match(source, /FSRS-4\.5/);
    assert.doesNotMatch(source, /SM-2/);
    assert.doesNotMatch(source, /956 commits/);
    assert.match(source, /one-time unlock/i);
    assert.match(source, /https:\/\/testflight\.apple\.com\/join\/Zu9rzg59/);
  }
});

test('Echo keeps Coming in 1.0 only for still-tagged nightly work', () => {
  assert.match(echo, /\*\*Mark Now, Card Later:\*\*/);
  assert.doesNotMatch(echo, /\*\*Mark Now, Card Later\*\* 🚧/);
  assert.match(echo, /\*\*Second-Brain Export:\*\*/);
  assert.doesNotMatch(echo, /\*\*Second-Brain Export\*\* 🚧/);
  assert.match(echo, /\*\*On-Device AI Narration:\*\*/);
  assert.doesNotMatch(echo, /\*\*On-Device AI Narration\*\* 🚧/);
  assert.match(echo, /\*\*Insights That Are Real:\*\*/);
  assert.doesNotMatch(echo, /\*\*Insights That Are Real\*\*.*Coming in 1\.0/);
  assert.match(echo, /\[Docs\]\(https:\/\/dfakkeldy\.github\.io\/Echo\/\)/);
  assert.match(theme, /<h3>Mark Now, Card Later<\/h3>/);
  assert.doesNotMatch(
    theme,
    /Mark Now, Card Later <span class="soon-pill">Coming in 1\.0<\/span>/,
  );
  assert.match(theme, /<h3>Insights That Are Real<\/h3>/);
  assert.doesNotMatch(
    theme,
    /Insights That Are Real <span class="soon-pill">Coming in 1\.0<\/span>/,
  );
  assert.match(generatedEcho, /<h3>Insights That Are Real<\/h3>/);
  assert.doesNotMatch(
    generatedEcho,
    /Insights That Are Real <span class="soon-pill">Coming in 1\.0<\/span>/,
  );
});

test('NS Marks public copy leads with the live browser map and no App Store date', () => {
  assert.match(nsMarks, /\[Open Online Map\]\(\/apps\/nsmarksthespot\/map\/\)/);
  assert.match(nsMarks, /current product focus is the \*\*browser map\*\*/);
  assert.match(nsMarks, /position this device reports/);
  assert.match(nsMarks, /\*\*Live location:\*\* Optional live location/);
  assert.doesNotMatch(nsMarks, /GPS/i);
  assert.match(nsMarks, /not on the App Store/);
  assert.doesNotMatch(nsMarks, /13 Nov|November 2026/);
  assert.doesNotMatch(theme, /13 Nov|November 2026/);
  assert.doesNotMatch(theme, /optional GPS/i);
  assert.match(generatedNsMarks, /position this device reports/);
  assert.match(generatedNsMarks, /Optional live location/);
  assert.doesNotMatch(generatedNsMarks, /GPS/i);
  assert.match(generatedApps, /optional live location/);
  assert.doesNotMatch(generatedApps, /optional GPS/i);
});

test('NS Marks public copy names the focused Rhodena page, sight lines, and Map | Aerial bounds', () => {
  assert.match(nsMarks, /## Rhodena Wind/);
  assert.match(nsMarks, /\[\/rhodena\]\(\/rhodena\)/);
  assert.match(nsMarks, /\[\/apps\/nsmarksthespot\/map\/\]\(\/apps\/nsmarksthespot\/map\/\)/);
  assert.match(nsMarks, /\*\*Sight lines:\*\*/);
  assert.match(nsMarks, /\*\*Map \| Aerial:\*\*/);
  assert.match(nsMarks, /\[Rhodena Wind\]\(\/rhodena\)/);
  assert.match(nsMarksHelp, /The focused Rhodena Wind map is at \[\/rhodena\]\(\/rhodena\)\./);
  assert.match(nsMarksHelp, /I haven't written the FAQ yet/);
  assert.match(generatedNsMarks, /<h2>Rhodena Wind<\/h2>/);
  assert.match(generatedNsMarks, /href="\/rhodena">\/rhodena</);
  assert.match(generatedNsMarks, /href="\/rhodena">Rhodena Wind</);
  assert.match(generatedNsMarks, /<strong>Sight lines:<\/strong>/);
  assert.match(generatedNsMarks, /<strong>Map \| Aerial:<\/strong>/);
  for (const source of [nsMarks, generatedNsMarks]) {
    assert.match(source, /Rhodena Wind — proposed turbine map/);
    assert.match(source, /same pattern as \/poker/);
    assert.match(source, /research map with a Rhodena focus/);
    assert.match(source, /no service worker or offline pack/);
    assert.match(source, /eye-level \(~1\.7 m\)/);
    assert.match(source, /assessed 200 m tip/);
    assert.match(source, /viewshed colours/);
    assert.match(source, /bare earth first obstructs/);
    assert.match(source, /ridge mark and a dotted remainder/);
    assert.match(source, /trees, buildings, and the final design are not in the model/i);
    assert.match(source, /tip height, not the hub/);
    assert.match(source, /provisional proposed layout/);
    assert.match(source, /Near-threshold results stay amber/);
    assert.match(source, /Unassessed or out-of-range turbines get no line/);
    assert.match(source, /under the 3D control/);
    assert.match(source, /Province licence gate/);
    assert.doesNotMatch(source, /native parity/i);
    assert.doesNotMatch(source, /GPS/i);
  }
});

test('NS Marks search copy includes postal communities and labelled mailing addresses', () => {
  for (const source of [nsMarks, generatedNsMarks]) {
    assert.match(source, /PID, civic address, or postal community/);
    assert.match(
      source,
      /postal candidate becomes selectable only when it resolves to one live provincial civic point/,
    );
    assert.match(
      source,
      /separately labelled mailing address from Statistics Canada's free National Address Register \(June 2026\)/,
    );
    assert.match(source, /distinct from the provincial civic address/);
    assert.match(source, /Boundaries are approximate context, never a legal survey/);
    assert.doesNotMatch(source, /Search a parcel by PID or civic address,/);
    assert.doesNotMatch(source, /Canada Post/);
    assert.doesNotMatch(source, /paid API/i);
    assert.doesNotMatch(source, /dede523126274be0e34f086ede7b2aafff130431/);
  }
});

test('apps listing NS Marks card names postal community without NAR mailing copy', () => {
  for (const source of [theme, generatedApps]) {
    assert.match(source, /parcel search by PID, civic address, or postal community/);
    assert.doesNotMatch(source, /parcel search by PID or civic address/);
  }
  assert.doesNotMatch(generatedApps, /National Address Register/);
  assert.doesNotMatch(generatedApps, /Canada Post/);
  assert.doesNotMatch(generatedApps, /paid API/i);
});

test('homepage and apps cards point at on-site app pages', () => {
  assert.match(theme, /class="app-card" href="\/apps\/macromark\/"/);
  assert.doesNotMatch(theme, /class="app-card" href="\/apps\/routey\/"/);
  assert.match(theme, /class="app-card" href="\/apps\/visualtimer\/"/);
  assert.doesNotMatch(theme, /dfakkeldy\.github\.io\/MacroMark/);
  assert.doesNotMatch(theme, /dfakkeldy\.github\.io\/Routey/);
  assert.doesNotMatch(theme, /dfakkeldy\.github\.io\/VisualTimer/);
  assert.equal(
    [...theme.matchAll(/class="app-card" href="\/apps\/nsmarksthespot\/"/g)].length,
    2,
  );
});

test('Turn Timer mentions the on-site PWA and keeps the live TestFlight join', () => {
  assert.match(visualTimer, /\/tools\/turn-timer\//);
  assert.match(visualTimer, /https:\/\/testflight\.apple\.com\/join\/s7w4YGWU/);
  assert.match(visualTimer, /not on the App Store yet/);
});

test('Echo beta guide uses the live public join and Burly stays off the public tree', () => {
  assert.match(echoBeta, /https:\/\/testflight\.apple\.com\/join\/Zu9rzg59/);
  assert.equal(existsSync(new URL('../../Content/apps/burly.md', import.meta.url)), false);
  assert.doesNotMatch(theme, /\/apps\/burly/);
});
