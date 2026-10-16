import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

test('Gas Price Watch is discoverable in the static sitemap and shared footer', () => {
  assert.match(read('Sources/KinNoKiLabsSite/main.swift'), /"gas\/"/);
  assert.match(read('Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift'), /\("\/gas\/", "Gas Price Watch"\)/);
});

test('public privacy copy covers public price downloads and local zone choice', () => {
  const privacy = read('Content/privacy.md');
  assert.match(privacy, /Gas Price Watch/);
  assert.match(privacy, /GitHub/);
  assert.match(privacy, /zone choice.*browser/i);
});

test('hosted refresh uses an hourly data branch without untrusted PR or main pushes', () => {
  const workflow = read('.github/workflows/refresh-gas-price-watch.yml');
  assert.match(workflow, /cron: ["']17 \* \* \* \*["']/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /ref: gas-price-watch-data/);
  assert.match(workflow, /hosted_refresh\.py/);
  assert.match(workflow, /poppler-utils/);
  assert.match(workflow, /git add -- latest\.json issued-forecasts/);
  assert.match(workflow, /git push origin HEAD:gas-price-watch-data/);
  assert.doesNotMatch(workflow, /pull_request_target|--force|HEAD:main|secrets\./);
  assert.match(workflow, /steps\.refresh\.outcome == 'failure'/);
});
