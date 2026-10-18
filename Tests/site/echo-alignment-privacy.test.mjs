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
  /1\.0 release does not expose an action for uploading alignments/,
  /does not promise that a matching record exists or that a request will succeed/,
  /If you shared an alignment using another build/,
  /signing out does not itself delete public copies/,
  /no automatic expiry for shared alignment records/,
  /no in-app deletion control/,
  /do not state a fixed retention period for past public alignments or guarantee removal of copies obtained by other users/,
];

// These cases cover the approved privacy/help changes. The manual and marketing
// copy require a separate correction; passing these tests does not clear them.
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
