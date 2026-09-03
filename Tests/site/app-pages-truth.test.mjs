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

test('homepage and apps cards point at on-site app pages', () => {
  assert.match(theme, /class="app-card" href="\/apps\/macromark\/"/);
  assert.match(theme, /class="app-card" href="\/apps\/routey\/"/);
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
