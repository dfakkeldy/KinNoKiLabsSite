import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const theme = readFileSync(
  new URL('../../Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift', import.meta.url),
  'utf8',
);
const site = readFileSync(
  new URL('../../Sources/KinNoKiLabsSite/main.swift', import.meta.url),
  'utf8',
);
const homeContent = readFileSync(new URL('../../Content/index.md', import.meta.url), 'utf8');
const servicesContent = readFileSync(new URL('../../Content/services.md', import.meta.url), 'utf8');
const aboutContent = readFileSync(new URL('../../Content/about.md', import.meta.url), 'utf8');
const generatedHome = readFileSync(new URL('../../Output/index.html', import.meta.url), 'utf8');
const generatedServices = readFileSync(
  new URL('../../Output/services/index.html', import.meta.url),
  'utf8',
);
const generatedAbout = readFileSync(
  new URL('../../Output/about/index.html', import.meta.url),
  'utf8',
);

test('positions KinNoKi as a general technical problem-solving studio', () => {
  const expectedDescription =
    'KinNoKi Labs solves messy technical and operational problems with practical systems, automation, and custom software.';

  assert.match(site, new RegExp(expectedDescription.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(homeContent, new RegExp(expectedDescription.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(theme, /Independent technical studio · Nova Scotia/);
  assert.match(
    generatedHome,
    /I solve messy technical and operational problems — from spreadsheets, documents, websites, and disconnected tools/,
  );
  assert.doesNotMatch(theme, /Independent Apple-platform studio/);
  assert.doesNotMatch(site, /We build focused Apple-platform apps/);
});

test('makes the services page problem-first and technology-flexible', () => {
  for (const phrase of [
    'When the tools stop lining up, I make the work make sense.',
    'Technical Workflow Diagnostic',
    'Systems Cleanup &amp; Automation',
    'Practical Tools &amp; Knowledge Systems',
    'What’s tangled?',
    'Spreadsheets &amp; data',
    'Websites &amp; browser tools',
    'Mobile or custom software',
    'Apple release support — when that is the actual problem',
  ]) {
    assert.match(generatedServices, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(
    servicesContent,
    /The technology follows the problem: clean up what exists, connect the right pieces, and build something new only when it earns its place\./,
  );
  assert.doesNotMatch(generatedServices, /Repeated operational work, turned into practical software\./);
});

test('describes Apple work as proof and an optional specialty', () => {
  assert.match(
    generatedAbout,
    /The Apple apps are visible proof of that work, not the boundary of it\./,
  );
  assert.match(aboutContent, /Apple work is proof of technical depth and an optional specialty/);
  assert.match(theme, /Problem-first/);
  assert.doesNotMatch(
    generatedAbout,
    /is one person building focused Apple-platform apps — iOS, macOS, and watchOS — and practical software systems/,
  );
});
