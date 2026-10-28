import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// /learn and /taxsale show small WebP copies of the pinned 1600x2560 PNG
// covers. Tools/make-cover-thumbnails.sh writes them and records the source
// bytes; a cover that changes without a remade thumbnail fails here.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(root, 'Resources/images/covers');
const manifest = JSON.parse(readFileSync(path.join(dir, 'thumbnails.json'), 'utf8'));
const theme = readFileSync(path.join(root, 'Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift'), 'utf8');

const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
function dimensions(file) {
  const output = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
  return [Number(output.match(/pixelWidth: (\d+)/)[1]), Number(output.match(/pixelHeight: (\d+)/)[1])];
}

test('every cover thumbnail matches its current source cover and is 640x1024', () => {
  assert.equal(manifest.schemaVersion, 1);
  const names = Object.keys(manifest.thumbnails).sort();
  assert.deepEqual(readdirSync(dir).filter((name) => name.endsWith('.webp')).sort(), names);
  for (const name of names) {
    const entry = manifest.thumbnails[name];
    const file = path.join(dir, name);
    assert.equal(hash(path.join(root, 'Resources', entry.source)), entry.sourceSha256, `${name}: source cover changed; run Tools/make-cover-thumbnails.sh`);
    assert.equal(hash(file), entry.sha256, `${name}: thumbnail bytes changed`);
    assert.deepEqual(dimensions(file), [640, 1024]);
    assert.ok(readFileSync(file).length < 150 * 1024, `${name} stays small`);
  }
});

test('cover thumbnails are what the pages show, and every one is used', () => {
  for (const name of Object.keys(manifest.thumbnails)) {
    assert.match(theme, new RegExp(`src="/images/covers/${name.replace(/\./g, '\\.')}"[^>]*width="640" height="1024"`));
  }
  assert.doesNotMatch(theme, /<img class="(learn|tax)-book-cover" src="[^"]+\.png"/);
});
