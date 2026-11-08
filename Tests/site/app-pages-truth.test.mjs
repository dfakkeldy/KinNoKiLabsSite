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
const macromark = readFileSync(
  new URL('../../Content/apps/macromark.md', import.meta.url),
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
const generatedHome = readFileSync(
  new URL('../../Output/index.html', import.meta.url),
  'utf8',
);
const generatedMacromark = readFileSync(
  new URL('../../Output/apps/macromark/index.html', import.meta.url),
  'utf8',
);

test('Echo public copy uses FSRS and drops the stale commit boast', () => {
  for (const source of [echo, theme]) {
    assert.match(source, /FSRS-4\.5/);
    assert.doesNotMatch(source, /SM-2/);
    assert.doesNotMatch(source, /956 commits/);
    assert.match(source, /one-time unlock/i);
  }
});

test('Echo says 1.0 is on the App Store and keeps the beta for early builds', () => {
  const storeURL = /https:\/\/apps\.apple\.com\/ca\/app\/audiobook-study-player-echo\/id6779836394/;
  assert.match(echo, /^status: App Store — 1\.0$/m);
  for (const source of [echo, theme, generatedEcho, generatedApps, generatedHome]) {
    assert.match(source, storeURL);
  }
  assert.match(generatedApps, /<h2>Echo<\/h2>[\s\S]*?<span class="status-chip">App Store — 1\.0<\/span>/);
  for (const source of [echo, generatedEcho]) {
    assert.doesNotMatch(source, /open beta right now|current TestFlight beta|open development toward 1\.0/i);
    assert.doesNotMatch(source, /Coming in 1\.0/);
  }
  // No app is in TestFlight-only status any more, so the legend drops that row.
  assert.doesNotMatch(theme, /<span class="status-chip">TestFlight beta<\/span>/);
});

test('Echo guides tag unshipped work as roadmap, not as part of 1.0', () => {
  const guides = ['echo', 'echo-manual', 'echo-learn', 'echo-focus', 'echo-help', 'echo-beta', 'echo-devlog'].map(
    (name) =>
      readFileSync(
        new URL(name === 'echo' ? '../../Content/apps/echo.md' : `../../Content/${name}.md`, import.meta.url),
        'utf8',
      ),
  );
  for (const source of guides) {
    assert.doesNotMatch(source, /🚧|Coming in 1\.0/);
    assert.doesNotMatch(source, /ships? (with|in) 1\.0|arrives? with (Echo )?1\.0|Once 1\.0 lands|with 1\.0 imports|coming with 1\.0/i);
    assert.doesNotMatch(source, /current TestFlight beta|open development toward 1\.0/i);
  }
  // Not in the 1.0 build: .apkg import, Brain Dump, and full iCloud study sync.
  assert.match(echo, /\*\*Brain Dump\*\* 🔭 \*\*Roadmap:\*\*/);
  assert.match(echo, /real \.apkg Anki import[^\n]*Roadmap/);
});

test('Echo marks shipped 1.0 features without a status tag', () => {
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
  assert.match(nsMarks, /href="\/apps\/nsmarksthespot\/map\/">Open Online Map<\/a>/);
  assert.match(nsMarks, /current product focus is the \*\*browser map\*\*/);
  assert.match(nsMarks, /position this device reports/);
  assert.match(nsMarks, /\*\*Live location\*\* Optional live location/);
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

test('NS Marks public copy names the focused Rhodena page and keeps the sight-line model limits', () => {
  assert.match(nsMarks, /## Two focused maps/);
  assert.match(nsMarks, /<a class="btn btn-outline" href="\/rhodena">Open Rhodena Wind<\/a>/);
  assert.match(nsMarks, /id="rhodena"/);
  assert.match(nsMarksHelp, /href=\"\/rhodena\">.*?<span>Rhodena Wind map<\/span><span class=\"support-row-sub\">Research map, Rhodena Wind focus</);
  assert.doesNotMatch(nsMarksHelp, /I haven't written the FAQ yet/);
  assert.match(generatedNsMarks, /<h3 id="rhodena-title">Rhodena Wind<\/h3>/);
  assert.match(generatedNsMarks, /href="\/rhodena">Open Rhodena Wind</);
  for (const source of [nsMarks, generatedNsMarks]) {
    assert.match(source, /same research map/);
    assert.doesNotMatch(source, /same pattern as \/poker/);
    assert.doesNotMatch(source, /service worker/);
    // The page states what the lines can and cannot show.
    assert.match(source, /each assessed 200 m tip/);
    assert.match(source, /bare earth first obstructs/);
    assert.match(source, /trees, buildings, and the final design are not in the model/i);
    assert.match(source, /provisional proposed layout/);
    assert.match(source, /eye-level \(~1\.7 m\)/);
    assert.match(source, /tip height, not the hub/);
    assert.match(source, /Near-threshold results stay amber/);
    assert.match(source, /Unassessed or out-of-range turbines get no line/);
    assert.match(source, /Aerial imagery opens the Province licence gate/);
    assert.match(source, /its own source, licence gate, and attribution/);
    assert.doesNotMatch(source, /native parity/i);
    assert.doesNotMatch(source, /GPS/i);
  }
});

test('NS Marks public copy names the fishing focus page at /fishmap, separate from the static /fishing/ guide', () => {
  assert.match(nsMarks, /<a class="btn btn-outline" href="\/fishmap">Open the fishing map<\/a>/);
  assert.match(nsMarks, /id="fishing"/);
  assert.match(nsMarks, /separate from the static \[Strait and Bras d'Or Fishing Map\]\(\/fishing\/\)/);
  assert.match(nsMarksHelp, /href=\"\/fishmap\">.*?<span>Fishing focus map<\/span><span class=\"support-row-sub\">Research map, fishing focus</);
  assert.match(nsMarksHelp, /href=\"\/fishing\/\">.*?<span class=\"support-row-sub\">A static fishing guide, separate from the research map</);
  assert.match(generatedNsMarks, /<h3 id="fishing-title">Fishing<\/h3>/);
  for (const source of [nsMarks, generatedNsMarks]) {
    assert.doesNotMatch(source, /short-URL pattern/);
    assert.match(source, /never says a season is open now/);
    assert.match(source, /not permission to fish from the wharf/);
    assert.doesNotMatch(source, /fish from the road allowance/i);
  }
});

test('NS Marks marketing page shows the app, not the non-commercial Fletcher scan', () => {
  for (const source of [nsMarks, generatedNsMarks]) {
    assert.doesNotMatch(source, /fletcher-features\/excerpts/);
    assert.doesNotMatch(source, /CC BY-NC-SA/);
  }
  assert.match(nsMarks, /<img src="\/images\/apps\/nsmarksthespot-layers\.webp"/);
  assert.ok(existsSync(new URL('../../Resources/images/apps/nsmarksthespot-layers.webp', import.meta.url)));
});

test('NS Marks search copy includes postal communities and labelled mailing addresses', () => {
  for (const source of [nsMarks, generatedNsMarks]) {
    assert.match(source, /PID, civic address, or postal community/);
    assert.match(source, /a civic address or a postal community/);
    assert.match(source, /Mailing addresses come from Statistics Canada's free National Address Register \(June 2026\)/);
    assert.match(
      source,
      /postal candidate becomes selectable only when it resolves to one live provincial civic point/,
    );
    assert.match(source, /labelled as distinct from the provincial civic address/);
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
  // The apps list row links whole; the homepage lab card has a stretched title link.
  assert.equal(
    [...theme.matchAll(/class="app-card" href="\/apps\/nsmarksthespot\/"/g)].length,
    1,
  );
  assert.match(theme, /class="app-card-link" href="\/apps\/nsmarksthespot\/"/);
  assert.match(theme, /class="app-card-link" href="\/apps\/macromark\/"/);
});

test('Turn Timer says 1.0 is on the App Store and keeps the on-site PWA', () => {
  const storeURL = /https:\/\/apps\.apple\.com\/ca\/app\/turn-timer\/id6771073144/;
  assert.match(visualTimer, /\/tools\/turn-timer\//);
  assert.match(visualTimer, /^status: App Store — 1\.0$/m);
  assert.match(visualTimer, storeURL);
  assert.match(theme, storeURL);
  assert.doesNotMatch(visualTimer, /testflight|not on the App Store yet/i);
});

test('MacroMark public copy says 1.0 is live on the App Store and free', () => {
  const storeURL = 'https://apps.apple.com/ca/app/macromark/id6785081218';
  assert.match(macromark, /^status: App Store — 1\.0$/m);
  assert.match(macromark, new RegExp(storeURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  // The status line is plain text; the Download button is the one App Store link.
  assert.match(macromark, /MacroMark 1\.0 is live on the App Store and free\./);
  assert.match(macromark, /<img src="\/images\/apps\/macromark-inbox\.webp"/);
  assert.match(macromark, /<img src="\/images\/apps\/macromark-macros\.webp"/);
  for (const shot of ['macromark-inbox.webp', 'macromark-macros.webp']) {
    assert.ok(existsSync(new URL(`../../Resources/images/apps/${shot}`, import.meta.url)), shot);
  }
  assert.match(macromark, /and free/);
  assert.match(macromark, /Version 1\.1 is in testing/);
  assert.doesNotMatch(macromark, /Internal TestFlight/);
  assert.doesNotMatch(macromark, /not on the App Store yet/);
  assert.doesNotMatch(macromark, /toward V1\.0/);

  for (const source of [theme, generatedHome, generatedApps]) {
    assert.match(source, /class="status-chip[^"]*"[^>]*>App Store — 1\.0</);
    assert.doesNotMatch(source, /status-chip">Internal TestFlight</);
  }
  assert.match(
    generatedHome,
    /href="https:\/\/apps\.apple\.com\/ca\/app\/macromark\/id6785081218"[^>]*>MacroMark 1\.0 on the App Store<\/a>/,
  );
  assert.match(generatedApps, /<dt><span class="status-chip">App Store — 1\.0<\/span><\/dt><dd>Download it now\.<\/dd>/);
  assert.match(generatedMacromark, /App Store — 1\.0/);
  assert.match(
    generatedMacromark,
    /href="https:\/\/apps\.apple\.com\/ca\/app\/macromark\/id6785081218"/,
  );
  assert.match(generatedMacromark, /and free/);
  assert.match(generatedMacromark, /Version 1\.1 is in testing/);
  assert.doesNotMatch(generatedMacromark, /not on the App Store yet/);
  assert.doesNotMatch(generatedMacromark, /Internal TestFlight/);
});

test('Echo beta guide uses the live public join and Burly stays off the public tree', () => {
  assert.match(echoBeta, /https:\/\/testflight\.apple\.com\/join\/Zu9rzg59/);
  assert.equal(existsSync(new URL('../../Content/apps/burly.md', import.meta.url)), false);
  assert.doesNotMatch(theme, /\/apps\/burly/);
});
