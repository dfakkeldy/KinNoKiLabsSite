import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

const dialogFacts = [
  /Shared alignments \(Echo, optional\)/,
  /optional, user-initiated Share Alignment/,
  /title, author, duration and alignment markers/,
  /public CloudKit database/,
  /persistent identifier derived from your iCloud account/,
  /Other Echo users can use these alignments/,
  /excludes audio, full book text and notes/,
  /no in-app control to delete a shared alignment/,
];

test('privacy policy discloses Echo public alignment sharing', () => {
  const privacy = read('Content/privacy.md');
  const generated = read('Output/privacy/index.html');
  assert.match(
    privacy,
    /iCloud sync, Echo's geocoding lookup, and Echo's optional public alignment sharing/,
  );
  assert.match(privacy, /all described below/);
  for (const [label, source] of [
    ['Content/privacy.md', privacy],
    ['Output/privacy/index.html', generated],
  ]) {
    for (const fact of dialogFacts) {
      assert.match(source, fact, `${label} must include ${fact}`);
    }
  }
});

test('Echo pages no longer claim every alignment stays only on-device', () => {
  assert.match(
    read('Content/apps/echo.md'),
    /Share Alignment in Book Settings is optional; it puts that book's title, author, duration and alignment markers in Echo's public CloudKit database/,
  );
  assert.doesNotMatch(
    read('Content/apps/echo.md'),
    /Everything lives on your device and your personal iCloud/,
  );
  assert.match(read('Content/echo-help.md'), /public CloudKit database if you choose Share Alignment/);
  const manual = read('Content/echo-manual.md');
  assert.match(manual, /Optional Share Alignment/);
  assert.doesNotMatch(manual, /no cloud APIs, no uploads, ever/);
});
