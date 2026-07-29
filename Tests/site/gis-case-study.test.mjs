import assert from 'node:assert/strict';
import {
  readdirSync,
  readFileSync,
} from 'node:fs';
import test from 'node:test';

const content = readFileSync(new URL('../../Content/gis.md', import.meta.url), 'utf8');
const nsMarksContent = readFileSync(
  new URL('../../Content/apps/nsmarksthespot.md', import.meta.url),
  'utf8',
);
const theme = readFileSync(
  new URL('../../Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift', import.meta.url),
  'utf8',
);
const styles = readFileSync(new URL('../../Resources/styles.css', import.meta.url), 'utf8');
const provenance = JSON.parse(
  readFileSync(
    new URL('../../Tools/gis-portfolio-art/provenance.json', import.meta.url),
    'utf8',
  ),
);
const generated = readFileSync(new URL('../../Output/gis/index.html', import.meta.url), 'utf8');
const generatedServices = readFileSync(
  new URL('../../Output/services/index.html', import.meta.url),
  'utf8',
);
const generatedApps = readFileSync(
  new URL('../../Output/apps/index.html', import.meta.url),
  'utf8',
);
const generatedNsMarks = readFileSync(
  new URL('../../Output/apps/nsmarksthespot/index.html', import.meta.url),
  'utf8',
);
const generatedStyles = readFileSync(new URL('../../Output/styles.css', import.meta.url), 'utf8');

const assetNames = [
  'aerial-mosaic-2015.webp',
  'field-classification-2013.webp',
  'ns-marks-product-2026.webp',
  'planting-review-2023.webp',
  'visibility-analysis-2023.webp',
];

test('routes the GIS source page through the custom case-study renderer', () => {
  assert.match(content, /title: From Field Maps to Mapping Products/);
  assert.match(content, /image: \/images\/gis\/ns-marks-product-2026\.webp/);
  assert.match(theme, /case "gis":\s+main = gisCaseStudyMain\(\)/);
  assert.match(theme, /private func gisCaseStudyMain\(\)/);
  assert.match(generated, /<body class="page-page page-gis">/);
  assert.match(
    generated,
    /<link rel="canonical" href="https:\/\/kinnokilabs\.com\/gis"\/>/,
  );
});

test('publishes five chronological examples with explicit evidence boundaries', () => {
  assert.equal(generated.match(/<article class="gis-stop[^"]*"/g)?.length, 5);
  for (const year of ['2013', '2015', '2023', '2026']) {
    assert.match(generated, new RegExp(`>${year}<`));
  }
  for (const label of ['Problem', 'Inputs', 'Method', 'Output']) {
    assert.equal(
      generated.match(new RegExp(`<h3>${label}</h3>`, 'g'))?.length,
      5,
      `${label} must appear once per example`,
    );
  }
  assert.equal(generated.match(/<strong>It supported:<\/strong>/g)?.length, 4);
  assert.equal(generated.match(/<strong>It supports:<\/strong>/g)?.length, 1);
  assert.equal(generated.match(/<strong>It did not establish:<\/strong>/g)?.length, 5);
});

test('keeps the portfolio limitation and public-safe transformations visible', () => {
  assert.match(generated, /Original client work stays private/);
  assert.match(generated, /Public-safe reconstruction/);
  assert.match(generated, /Portfolio, not authority\./);
  assert.match(
    generated,
    /not proof of title, boundary, access, value, permissions, condition, service, regulatory approval, or current source status/,
  );
  assert.doesNotMatch(generated, /\/Users\//);
  assert.doesNotMatch(generated, /gmail/i);
  assert.doesNotMatch(generated, /message id/i);
});

test('publishes only the five reviewed WebP assets and preserves dimensions and alt text', () => {
  const sourceDir = new URL('../../Resources/images/gis/', import.meta.url);
  const outputDir = new URL('../../Output/images/gis/', import.meta.url);
  assert.deepEqual(readdirSync(sourceDir).sort(), assetNames);
  assert.deepEqual(readdirSync(outputDir).sort(), assetNames);
  assert.equal(generated.match(/<img src="\/images\/gis\//g)?.length, 5);
  assert.equal(generated.match(/width="1440" height="900"/g)?.length, 5);
  assert.equal(generated.match(/<img src="\/images\/gis\/[^"]+"[^>]+alt="[^"]+"/g)?.length, 5);

  for (const name of assetNames) {
    assert.deepEqual(
      readFileSync(new URL(name, outputDir)),
      readFileSync(new URL(name, sourceDir)),
      `${name} must be copied unchanged into Output`,
    );
  }
});

test('records authorship, transformation, and visible-layer rights for every example', () => {
  assert.equal(provenance.schemaVersion, 1);
  assert.equal(provenance.items.length, 5);
  assert.equal(new Set(provenance.items.map((item) => item.id)).size, 5);

  for (const item of provenance.items) {
    assert.match(item.sourceSha256, /^[a-f0-9]{64}$/);
    assert.ok(item.authorshipEvidence.length >= 60);
    assert.ok(item.transformation.length >= 40);
    assert.ok(item.visibleLayerRights.length >= 40);
    assert.match(item.publishedAsset, /^\/images\/gis\/[-a-z0-9]+\.webp$/);
  }

  const serialized = JSON.stringify(provenance);
  assert.doesNotMatch(serialized, /\/Users\//);
  assert.doesNotMatch(serialized, /gmail/i);
  assert.doesNotMatch(serialized, /@/);
});

test('cross-links the case study from services, apps, and NS Marks The Spot', () => {
  assert.match(generatedServices, /href="\/gis\/">Explore the GIS case study/);
  assert.match(generatedApps, /href="\/gis\/">GIS case study/);
  assert.match(nsMarksContent, /\[From Field Maps to Mapping Products\]\(\/gis\/\)/);
  assert.match(
    generatedNsMarks,
    /href="\/gis\/">From Field Maps to Mapping Products<\/a>/,
  );
  assert.match(generated, /href="\/services">See all services<\/a>/);
  assert.match(generated, /href="\/apps">Explore the apps<\/a>/);
  assert.match(generated, /href="\/apps\/nsmarksthespot\/">NS Marks The Spot<\/a>/);
});

test('ships the responsive GIS source styles unchanged', () => {
  for (const selector of [
    '.gis-hero',
    '.gis-timeline-nav',
    '.gis-transect',
    '.gis-stop',
    '.gis-boundary',
    '.gis-practice-grid',
    '.gis-disclaimer',
  ]) {
    assert.match(styles, new RegExp(selector.replace('.', '\\.')));
  }
  assert.match(styles, /@media \(max-width: 620px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.gis-main a:focus-visible/);
  assert.equal(generatedStyles, styles);
});
