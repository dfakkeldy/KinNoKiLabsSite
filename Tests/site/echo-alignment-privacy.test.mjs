import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

const alignmentFacts = [
  /When external fetching is permitted/,
  /configured CloudKit container/,
  /deterministic record identifier derived from the book/,
  /title, author and duration/,
  /lookup does not publish your local anchors, audio, full book text or notes/,
  /ordinary lookup failure can fall back to local alignment/,
  /current release does not expose an action for uploading alignments/,
  /does not promise that a matching record exists or that a request will succeed/,
  /If you shared an alignment using another build/,
  /signing out does not itself delete public copies/,
  /no automatic expiry for shared alignment records/,
  /no in-app deletion control/,
  /do not state a fixed retention period for past public alignments or guarantee removal of copies obtained by other users/,
];

// These cases cover the approved privacy/help text and the matching manual and
// app privacy paragraph, including the app Markdown rendered in RSS. They do not
// certify unrelated feature or marketing copy.
test('dedicated Echo privacy covers lookup, deferred uploads and historical public copies', () => {
  for (const [label, source] of [
    ['Content/privacy.md', read('Content/privacy.md')],
    ['Output/privacy/index.html', read('Output/privacy/index.html')],
  ]) {
    assert.match(source, /\/echo-privacy\//, `${label} must link the dedicated Echo policy`);
    assert.match(source, /do not describe Echo/, `${label} must exclude Echo from shared app claims`);
    assert.match(source, /\/nsmarksthespot-privacy\//, `${label} must preserve the native NS policy link`);
    assert.match(source, /public uploads deferred for 1\.0/, `${label} must describe the release scope`);
  }
  for (const [label, source] of [
    ['Content/echo-privacy.md', read('Content/echo-privacy.md')],
    ['Output/echo-privacy/index.html', read('Output/echo-privacy/index.html')],
  ]) {
    for (const fact of alignmentFacts) {
      assert.match(source, fact, `${label} must include ${fact}`);
    }
  }
});

test('Echo source and its RSS item preserve the approved privacy and availability limits', async t => {
  const items = read('Output/feed.rss').match(/<item>.*?<\/item>/gs) ?? [];
  const echoItems = items.filter(item => /<link>https:\/\/kinnokilabs\.com\/apps\/echo\/?<\/link>/.test(item));
  assert.equal(echoItems.length, 1, 'the feed must contain exactly one Echo app item');
  const encoded = echoItems[0].match(/<content:encoded>(.*?)<\/content:encoded>/s)?.[1];
  assert.ok(encoded, 'the Echo item must include its rendered Markdown body');
  const rendered = encoded.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
  for (const [label, source] of [
    ['Content/apps/echo.md', read('Content/apps/echo.md')],
    ['Output/feed.rss Echo item', rendered],
  ]) {
    await t.test(label, () => {
      for (const fact of [
        /The current release does not expose public-alignment uploads/,
        /look up matching public alignment anchors/,
        /local fallback for an ordinary lookup failure/,
        /device may supply a precise fix/,
        /rounds coordinates before asking Apple/,
        /Local deletion does not erase providers(?:'|’|&#39;|&apos;|&#x27;) records or device backups/,
        /does not promise complete private synchronization/,
        /Core playback and reading need no Echo account/,
        /External AI sends book text to the provider you configure/,
        /provider(?:'|’|&#39;|&apos;|&#x27;)s retention and training policies/,
        /\/echo-privacy\//,
      ]) {
        assert.match(source, fact, `${label} must include ${fact}`);
      }
      assert.doesNotMatch(source, /Share Alignment in Book Settings is optional|No accounts, no analytics, no tracking, no servers\.|Approximate, on-device, deletable\./);
    });
  }
});

test('Echo help explains optional network routes without promising complete private sync', () => {
  for (const [label, source] of [
    ['Content/echo-help.md', read('Content/echo-help.md')],
    ['Output/echo-help/index.html', read('Output/echo-help/index.html')],
  ]) {
    for (const fact of [
      /Context Memory is optional and off by default/,
      /device can provide a precise fix/,
      /rounds coordinates before asking Apple/,
      /stores the resulting context locally/,
      /not providers(?:'|’|&#39;|&apos;|&#x27;) records or backups/,
      /does not promise complete private synchronization/,
      /look up matching public alignment anchors when network access is permitted/,
      /local fallback for an ordinary lookup failure/,
      /does not expose public-alignment uploads/,
      /required files and models already present/,
      /External AI sends book text to the configured provider/,
      /\/echo-privacy\//,
    ]) {
      assert.match(source, fact, `${label} must include ${fact}`);
    }
    assert.doesNotMatch(source, /public CloudKit database if you choose Share Alignment/);
    assert.doesNotMatch(source, /only network.*iCloud.*Share Alignment/is);
  }
});

test('Echo manual and app privacy copy match the approved connected-service limits', () => {
  for (const [label, source] of [
    ['Content/echo-manual.md', read('Content/echo-manual.md')],
    ['Output/echo-manual/index.html', read('Output/echo-manual/index.html')],
  ]) {
    for (const fact of [
      /The current release does not expose public-alignment uploads/,
      /Earlier builds offered an upload of title, author, duration and alignment markers/,
      /persistent identifier derived from the uploader/,
      /deleting local content or signing out does not itself delete public copies/,
      /client sets no automatic expiry and has no in-app deletion control for past shared alignments/,
      /copies obtained by others have separate handling/,
      /deterministic record identifier derived from the book/,
      /does not publish local anchors, audio, full book text or notes/,
      /local fallback for an ordinary lookup failure/,
      /does not promise complete private synchronization/,
      /device may supply a precise fix/,
      /rounds coordinates to two decimal places before asking Apple/,
      /does not erase providers(?:'|’|&#39;|&apos;|&#x27;) records or device backups/,
      /Optional external-AI features send book text to the provider you configure/,
      /Support emails are retained indefinitely, and there is no support-email deletion system/,
      /\/echo-privacy\//,
    ]) {
      assert.match(source, fact, `${label} must include ${fact}`);
    }
    assert.doesNotMatch(source, /Optional Share Alignment|Confirming it puts|No server ever sees a number|Approximate places only|permanently erases every captured place|No chatbots, no generative features today|The only network use is/);
  }
  for (const [label, source] of [
    ['Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift', read('Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift')],
    ['Output/apps/echo/index.html', read('Output/apps/echo/index.html')],
  ]) {
    const privacyCard = source.match(/<h3>Radically private<\/h3><p>(.*?)<\/p>/s)?.[1];
    assert.ok(privacyCard, `${label} must retain the Echo privacy paragraph`);
    assert.match(privacyCard, /Core playback and reading need no Echo account/, `${label} must scope the account statement`);
    assert.match(privacyCard, /Optional connected services have separate data handling/, `${label} must disclose connected services`);
    assert.match(privacyCard, /\/echo-privacy\//, `${label} must link the dedicated policy`);
    assert.doesNotMatch(privacyCard, /No accounts, no analytics, no tracking, no servers\./);
  }
});
