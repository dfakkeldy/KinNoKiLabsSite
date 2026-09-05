import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

const main = readFileSync(new URL('../../Sources/KinNoKiLabsSite/main.swift', import.meta.url), 'utf8');
const showcase = readFileSync(
  new URL('../../Sources/KinNoKiLabsSite/TenderShowcase.swift', import.meta.url),
  'utf8',
);
const theme = readFileSync(
  new URL('../../Sources/KinNoKiLabsSite/Theme/KinNoKiTheme.swift', import.meta.url),
  'utf8',
);
const styles = readFileSync(new URL('../../Resources/styles.css', import.meta.url), 'utf8');

const tenderDir = new URL('../../Content/tenders/', import.meta.url);
const tenderFiles = existsSync(tenderDir)
  ? readdirSync(tenderDir).filter((f) => f.endsWith('.md')).sort()
  : [];

const DISCLAIMER =
  'Planning aid only. Verify all requirements, deadlines, documents, and addenda at the linked official procurement source before acting or bidding.';

const REQUIRED_H2 = [
  '## What the official source says',
  '## Who might examine this opportunity',
  '## Questions to verify',
  '## Suggested first review steps',
  '## KinNoKi analysis',
];

const METADATA_KEYS = [
  'tenderID',
  'issuer',
  'procurementSystem',
  'category',
  'deliveryRegion',
  'publishedAt',
  'closingAt',
  'firstAddedAt',
  'checkedAt',
  'documentAccess',
  'addendaURL',
  'addendaStatus',
  'lifecycle',
  'noticeURL',
  'documentsURL',
  'featuredPack',
];

const LIFECYCLE_RAW_VALUES = [
  'current',
  'closing-soon',
  'closed-demo',
  'withdrawn',
  'superseded',
  'source-unavailable',
  'addenda-unchecked',
];

// ---------------------------------------------------------------------------
// Source contract
// ---------------------------------------------------------------------------

test('declares the tenders section in the site configuration', () => {
  assert.match(main, /case\s+tenders\b/);
});

test('declares every tender metadata field in ItemMetadata', () => {
  for (const key of METADATA_KEYS) {
    assert.match(main, new RegExp(`var\\s+${key}\\s*:`), `ItemMetadata must declare ${key}`);
  }
});

test('keeps tenders out of the public RSS feed', () => {
  assert.match(
    main,
    /including:\s*Set\(\[KinNoKiLabsSite\.SectionID\.apps,\s*\.posts\]\)/,
  );
});

test('defines all seven lifecycle raw values with labels', () => {
  for (const raw of LIFECYCLE_RAW_VALUES) {
    assert.match(showcase, new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(showcase, /enum\s+TenderLifecycle/);
  assert.match(showcase, /case\s+current\b/);
  assert.match(showcase, /case\s+closingSoon\s*=\s*"closing-soon"/);
  assert.match(showcase, /case\s+closedDemo\s*=\s*"closed-demo"/);
  assert.match(showcase, /case\s+withdrawn\b/);
  assert.match(showcase, /case\s+superseded\b/);
  assert.match(showcase, /case\s+sourceUnavailable\s*=\s*"source-unavailable"/);
  assert.match(showcase, /case\s+addendaUnchecked\s*=\s*"addenda-unchecked"/);
});

test('defines a validated TenderRecord with a throwing initializer', () => {
  assert.match(showcase, /struct\s+TenderRecord\b/);
  assert.match(showcase, /init\(item:/);
  assert.match(showcase, /throws/);
});

test('defines the hub and detail rendering functions', () => {
  assert.match(showcase, /func\s+tenderShowcaseMain\b/);
  assert.match(showcase, /func\s+tenderDetailMain\b/);
});

test('uses the exact shared disclaimer text', () => {
  assert.match(showcase, new RegExp(DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('defines the structured mailto request contract', () => {
  assert.match(showcase, /mailto:hello@kinnokilabs\.com/);
  assert.match(showcase, /subject=Free%20Custom%20Tender%20Preview%20Request/);
  assert.match(showcase, /Public%20tender%20URL%20or%20ID/);
  assert.match(showcase, /Company%20or%20work%20type/);
  assert.match(showcase, /Contact%20name%20and%20preferred%20reply/);
  assert.match(showcase, /Why%20this%20may%20fit/);
});

test('does not use Node.raw for any tender source value', () => {
  // The renderer must not interpolate source values via raw HTML.
  // This is a guard: tenderDetailMain and tenderShowcaseMain must not contain .raw( calls
  // with item metadata interpolation. We check that .raw does not appear in the
  // rendering functions by asserting the functions are built with Plot DSL nodes.
  const detailMatch = showcase.match(/func\s+tenderDetailMain[\s\S]*?^}/m);
  if (detailMatch) {
    assert.doesNotMatch(detailMatch[0], /\.raw\(/);
  }
  const hubMatch = showcase.match(/func\s+tenderShowcaseMain[\s\S]*?^}/m);
  if (hubMatch) {
    assert.doesNotMatch(hubMatch[0], /\.raw\(/);
  }
});

test('routes the tender section and items in the theme', () => {
  assert.match(theme, /case\s+\.tenders:/);
  assert.match(theme, /tenderShowcaseMain/);
  assert.match(theme, /tenderDetailMain/);
  assert.match(theme, /page-tenders/);
  assert.match(theme, /page-tender-detail/);
});

// ---------------------------------------------------------------------------
// Content records
// ---------------------------------------------------------------------------

const EXPECTED_TENDER_RECORDS = {
  'hrm-autobody-painting-service.md': {
    tenderID: 'HRM-2026-0311',
    title: 'Autobody and Painting Services for HRM Light-Duty Vehicles (Halifax Location)',
    category: 'Services',
    closingAt: '2026-08-13T14:00:59-03:00',
    noticeURL: 'https://procurement-portal.novascotia.ca/tenders/HRM-2026-0311',
    documentsURL:
      'https://halifax.bidsandtenders.ca/Module/Tenders/en/Tender/Detail/45c893f6-58cd-4ae0-9ae9-20c997bac53e',
  },
  'hrm-cds-dvds-goods.md': {
    tenderID: 'HRM-2026-0372',
    title: "Standing Offer for the Supply & Delivery of CD's & DVD's",
    category: 'Goods',
    closingAt: '2026-08-12T14:00:59-03:00',
    noticeURL: 'https://procurement-portal.novascotia.ca/tenders/HRM-2026-0372',
    documentsURL:
      'https://halifax.bidsandtenders.ca/Module/Tenders/en/Tender/Detail/01b4409a-8391-4417-8e89-cd90af6948aa',
  },
  'hrm-street-recap-construction.md': {
    tenderID: 'HRM-2026-1026',
    title:
      'Prince Arthur Ave, Hershey Rd, Clyde St, and Montebello Dr - Street Recap. Intersection Reconfigurations, Traffic Calming and Sidewalk Renewals',
    category: 'Construction',
    closingAt: '2026-08-10T14:00:59-03:00',
    noticeURL: 'https://procurement-portal.novascotia.ca/tenders/HRM-2026-1026',
    documentsURL:
      'https://halifax.bidsandtenders.ca/Module/Tenders/en/Tender/Detail/b9edd22c-c23c-4a47-aada-587159f9ca58',
  },
  'nslc-agency-store-service.md': {
    tenderID: 'NSLC27-09',
    title: 'NSLC Agency Store - Cornwallis',
    category: 'Services',
    closingAt: '2026-08-13T14:00:00-03:00',
    noticeURL: 'https://procurement-portal.novascotia.ca/tenders/NSLC27-09',
    documentsURL: 'https://procurement-portal.novascotia.ca/tenders/NSLC27-09',
  },
};

function frontmatterValue(content, key) {
  return content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
}

test('locks every public tender title and authoritative source fact', () => {
  assert.deepEqual(tenderFiles, Object.keys(EXPECTED_TENDER_RECORDS).sort());
  for (const file of tenderFiles) {
    const content = readFileSync(
      new URL(`../../Content/tenders/${file}`, import.meta.url),
      'utf8',
    );
    const expected = EXPECTED_TENDER_RECORDS[file];
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(frontmatterValue(content, key), value, `${file}: ${key}`);
    }
  }
});

test('publishes three to five tender source records', () => {
  assert.ok(
    tenderFiles.length >= 3 && tenderFiles.length <= 5,
    `expected 3–5 tender records, found ${tenderFiles.length}: [${tenderFiles.join(', ')}]`,
  );
});

test('every source record has the required frontmatter fields and five H2 sections', () => {
  for (const file of tenderFiles) {
    const content = readFileSync(new URL(`../../Content/tenders/${file}`, import.meta.url), 'utf8');
    for (const key of METADATA_KEYS) {
      assert.match(content, new RegExp(`^${key}:`, 'm'), `${file} must declare ${key}`);
    }
    for (const h2 of REQUIRED_H2) {
      assert.match(
        content,
        new RegExp('^' + h2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'm'),
        `${file} must contain ${h2}`,
      );
    }
  }
});

test('all current entries satisfy the ten-calendar-day first-add rule', () => {
  const CURRENT_SELECTION = ['current', 'closing-soon', 'addenda-unchecked'];
  const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
  for (const file of tenderFiles) {
    const content = readFileSync(new URL(`../../Content/tenders/${file}`, import.meta.url), 'utf8');
    const lifecycle = content.match(/^lifecycle:\s*(\S+)/m)?.[1];
    if (!CURRENT_SELECTION.includes(lifecycle)) continue;
    const firstAdded = content.match(/^firstAddedAt:\s*(.+)$/m)?.[1]?.trim();
    const closing = content.match(/^closingAt:\s*(.+)$/m)?.[1]?.trim();
    assert.ok(firstAdded, `${file} must have firstAddedAt`);
    assert.ok(closing, `${file} must have closingAt`);
    const remaining = Date.parse(closing) - Date.parse(firstAdded);
    assert.ok(
      remaining >= TEN_DAYS_MS,
      `${file}: only ${remaining / (24 * 60 * 60 * 1000)} days between firstAddedAt and closingAt; need >= 10`,
    );
  }
});

test('includes exactly one featured pack', () => {
  let featuredCount = 0;
  for (const file of tenderFiles) {
    const content = readFileSync(new URL(`../../Content/tenders/${file}`, import.meta.url), 'utf8');
    if (/^featuredPack:\s*true/m.test(content)) featuredCount++;
  }
  assert.equal(featuredCount, 1, 'exactly one record must have featuredPack: true');
});

test('contains no AllSteel or Van Zutphen references anywhere in source', () => {
  let allSource = [main, showcase, theme, styles].join('\n');
  for (const file of tenderFiles) {
    allSource += '\n' + readFileSync(new URL(`../../Content/tenders/${file}`, import.meta.url), 'utf8');
  }
  assert.doesNotMatch(allSource, /AllSteel/i);
  assert.doesNotMatch(allSource, /Van\s*Zutphen/i);
});

test('all official URLs in frontmatter use HTTPS', () => {
  for (const file of tenderFiles) {
    const content = readFileSync(new URL(`../../Content/tenders/${file}`, import.meta.url), 'utf8');
    for (const key of ['noticeURL', 'documentsURL', 'addendaURL']) {
      const value = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
      if (value && value.length > 0) {
        assert.ok(
          value.startsWith('https://'),
          `${file}: ${key} must be HTTPS, got ${value}`,
        );
      }
    }
  }
});

// ---------------------------------------------------------------------------
// CSS contract
// ---------------------------------------------------------------------------

test('appends exactly one named Tender Starter Showcase CSS block', () => {
  const blockCount = (styles.match(/\/\* ===== Tender Starter Showcase ===== \*\//g) || []).length;
  assert.equal(blockCount, 1, 'exactly one named showcase CSS block');
});

test('defines all required tender CSS classes', () => {
  const requiredClasses = [
    '.tender-main',
    '.tender-hero',
    '.tender-actions',
    '.tender-source-note',
    '.tender-current-grid',
    '.tender-card',
    '.tender-state',
    '.tender-meta',
    '.tender-feature',
    '.tender-pack-list',
    '.tender-preview',
    '.tender-archive',
    '.tender-detail',
    '.tender-fact-grid',
    '.tender-disclaimer',
  ];
  for (const cls of requiredClasses) {
    assert.match(styles, new RegExp(cls.replace(/\./g, '\\.')), `CSS must define ${cls}`);
  }
});

test('includes reduced-motion, focus-visible, and print rules for tenders', () => {
  assert.match(styles, /prefers-reduced-motion[\s\S]*?\.tender/);
  assert.match(styles, /:focus-visible[\s\S]*?\.tender/);
  assert.match(styles, /@media print[\s\S]*?\.tender/);
});

// ---------------------------------------------------------------------------
// Demonstration pack
// ---------------------------------------------------------------------------

const packPath = new URL('../../Resources/tenders/tender-starter-example.zip', import.meta.url);
const packBytes = existsSync(packPath) ? readFileSync(packPath) : null;

test('ships a demonstration pack as a committed resource', () => {
  assert.equal(existsSync(packPath), true, 'tender-starter-example.zip must exist in Resources/tenders/');
});

if (packBytes) {
  test('pack contains exactly three named entries with no official tender documents', () => {
    // Minimal central-directory reader (stored + deflate entries).
    const entries = readZipEntries(packBytes);
    const names = entries.map((e) => e.name).sort();
    assert.deepEqual(names, ['official-sources.txt', 'tender-review-workbook.xlsx', 'tender-starter-guide.pdf']);
    for (const name of names) {
      assert.doesNotMatch(name, /\.(doc|docx)$/i, 'no DOC/DOCX in pack');
    }
  });

  test('official-sources.txt names every notice and direct HRM document source', () => {
    const entries = readZipEntries(packBytes);
    const txt = entries.find((entry) => entry.name === 'official-sources.txt');
    assert.ok(txt, 'official-sources.txt must be in the pack');
    const text = txt.data.toString('utf8');

    assert.match(text, new RegExp(DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    for (const expected of Object.values(EXPECTED_TENDER_RECORDS)) {
      assert.match(
        text,
        new RegExp(escapeRegex(`${expected.tenderID} — ${expected.title}`)),
      );
      assert.match(text, new RegExp(expected.noticeURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      if (expected.documentsURL !== expected.noticeURL) {
        assert.match(
          text,
          new RegExp(expected.documentsURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        );
      }
    }
    assert.doesNotMatch(text, /file:\/\//);
    assert.doesNotMatch(text, /\/Users\//);
  });

  test('PDF is tagged and PDF/UA-compliant', () => {
    const entries = readZipEntries(packBytes);
    const pdf = entries.find((e) => e.name === 'tender-starter-guide.pdf');
    assert.ok(pdf, 'PDF must be in the pack');
    const head = pdf.data.subarray(0, 4096).toString('latin1');
    const full = pdf.data.toString('latin1');
    assert.match(head, /^%PDF/);
    assert.match(full, /\/StructTreeRoot/);
    assert.match(full, /\/MarkInfo/);
    // pypdf may serialize the hyphen as the octal escape \055.
    assert.match(full, /\/Lang\s*\(en(?:-|\\055)CA\)/);
    assert.match(full, /pdfuaid:part/);
  });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Generated-route expectations (RED until Task 8 generates Output)
// ---------------------------------------------------------------------------

const outputHub = new URL('../../Output/tenders/index.html', import.meta.url);

test('generates the tender showcase hub route', () => {
  assert.equal(existsSync(outputHub), true, '/tenders/index.html must be generated');
  if (!existsSync(outputHub)) return;
  const hub = readFileSync(outputHub, 'utf8');
  assert.match(hub, /<link rel="canonical" href="https:\/\/kinnokilabs\.com\/tenders"\/>/);
  assert.match(hub, /<body class="page-section page-tenders">/);
  assert.match(hub, /Tender Starter Showcase/i);
  assert.ok(
    /tender-current-grid/.test(hub) || /No current examples at this time\. Check back later\./.test(hub),
    'hub must render the current grid or the truthful empty state',
  );
});

test('generates a detail page for each tender record', () => {
  for (const file of tenderFiles) {
    const slug = file.replace(/\.md$/, '');
    const detailPath = new URL(`../../Output/tenders/${slug}/index.html`, import.meta.url);
    assert.equal(existsSync(detailPath), true, `/tenders/${slug}/ must be generated`);
    if (!existsSync(detailPath)) continue;
    const detail = readFileSync(detailPath, 'utf8');
    assert.match(detail, /page-tender-detail/);
    assert.match(detail, /tender-fact-grid/);
    assert.match(detail, /tender-disclaimer/);
    assert.match(detail, /<time datetime="/);
  }
});

test('generated tender pages use human titles and exact official links', () => {
  const hub = readFileSync(outputHub, 'utf8');
  for (const [file, expected] of Object.entries(EXPECTED_TENDER_RECORDS)) {
    const slug = file.replace(/\.md$/, '');
    const detail = readFileSync(
      new URL(`../../Output/tenders/${slug}/index.html`, import.meta.url),
      'utf8',
    );
    const htmlTitle = escapeHtml(expected.title);
    assert.match(hub, new RegExp(escapeRegex(`<h3>${htmlTitle}</h3>`)));
    assert.match(detail, new RegExp(escapeRegex(`<h1>${htmlTitle}</h1>`)));
    assert.match(detail, new RegExp(escapeRegex(`<dd>${escapeHtml(expected.category)}</dd>`)));
    assert.match(detail, new RegExp(escapeRegex(`href="${escapeHtml(expected.noticeURL)}"`)));
    assert.match(detail, new RegExp(escapeRegex(`href="${escapeHtml(expected.documentsURL)}"`)));
    assert.doesNotMatch(detail, new RegExp(`<h1>${escapeRegex(slug)}</h1>`));
  }
});

test('keeps tender items out of the public RSS feed', () => {
  const feedPath = new URL('../../Output/feed.rss', import.meta.url);
  if (!existsSync(feedPath)) return;
  const feed = readFileSync(feedPath, 'utf8');
  for (const file of tenderFiles) {
    const slug = file.replace(/\.md$/, '');
    assert.doesNotMatch(feed, new RegExp(`tenders/${slug}`));
  }
});

test('includes tender routes in the sitemap', () => {
  const sitemapPath = new URL('../../Output/sitemap.xml', import.meta.url);
  if (!existsSync(sitemapPath)) return;
  const sitemap = readFileSync(sitemapPath, 'utf8');
  assert.match(sitemap, /https:\/\/kinnokilabs\.com\/tenders/);
  for (const file of tenderFiles) {
    const slug = file.replace(/\.md$/, '');
    assert.match(sitemap, new RegExp(`kinnokilabs\\.com/tenders/${slug}`));
  }
});

test('generated styles match the reviewed source CSS', () => {
  const generatedStylesPath = new URL('../../Output/styles.css', import.meta.url);
  if (!existsSync(generatedStylesPath)) return;
  assert.equal(readFileSync(generatedStylesPath, 'utf8'), styles);
});

test('public ZIP bytes match the resource ZIP', () => {
  const publicZip = new URL('../../Output/tenders/tender-starter-example.zip', import.meta.url);
  if (!existsSync(publicZip)) return;
  assert.deepEqual(readFileSync(publicZip), packBytes);
});

test('Services page links to the tender showcase', () => {
  const servicesGenerated = new URL('../../Output/services/index.html', import.meta.url);
  if (!existsSync(servicesGenerated)) return;
  const services = readFileSync(servicesGenerated, 'utf8');
  assert.match(services, /href="\/tenders\/"/);
  assert.match(services, /Tender Starter Showcase/i);
});

// ---------------------------------------------------------------------------
// Helpers — minimal ZIP central-directory reader (stored + deflate)
// ---------------------------------------------------------------------------

import { inflateRawSync } from 'node:zlib';

function readZipEntries(bytes) {
  // Find End of Central Directory record.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  assert.notEqual(eocd, -1, 'ZIP EOCD record not found');
  const cdCount = bytes.readUInt16LE(eocd + 10);
  let cdOffset = bytes.readUInt32LE(eocd + 16);

  const entries = [];
  for (let i = 0; i < cdCount; i++) {
    assert.equal(bytes.readUInt32LE(cdOffset), 0x02014b50, 'central directory file header signature');
    const compressionMethod = bytes.readUInt16LE(cdOffset + 10);
    const compressedSize = bytes.readUInt32LE(cdOffset + 20);
    const uncompressedSize = bytes.readUInt32LE(cdOffset + 24);
    const fileNameLength = bytes.readUInt16LE(cdOffset + 28);
    const extraFieldLength = bytes.readUInt16LE(cdOffset + 30);
    const commentLength = bytes.readUInt16LE(cdOffset + 32);
    const localHeaderOffset = bytes.readUInt32LE(cdOffset + 42);
    const name = bytes.subarray(cdOffset + 46, cdOffset + 46 + fileNameLength).toString('utf8');

    // Read local header to find actual data offset.
    assert.equal(bytes.readUInt32LE(localHeaderOffset), 0x04034b50, 'local file header signature');
    const localFileNameLength = bytes.readUInt16LE(localHeaderOffset + 26);
    const localExtraFieldLength = bytes.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
    const raw = bytes.subarray(dataOffset, dataOffset + compressedSize);

    let data;
    if (compressionMethod === 0) {
      data = raw;
    } else if (compressionMethod === 8) {
      data = inflateRawSync(raw);
    } else {
      throw new Error(`Unsupported ZIP compression method ${compressionMethod} for ${name}`);
    }

    assert.equal(data.length, uncompressedSize, `${name} decompressed size mismatch`);
    entries.push({ name, data });

    cdOffset += 46 + fileNameLength + extraFieldLength + commentLength;
  }
  return entries;
}
