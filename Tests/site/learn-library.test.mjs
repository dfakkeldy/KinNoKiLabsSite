import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../Output/learn/index.html', import.meta.url), 'utf8');
const count = (text) => html.split(text).length - 1;

const publicLibrary = 'https://github.com/dfakkeldy/explainer-audiobooks';
const approvedBooks = [
  {
    slug: 'chicken-predators',
    title: 'Chicken Predators',
    runtime: '16 chapters · about 3.1 hours',
    description: 'A Cape Breton field guide to identifying what is taking your chickens, protecting the flock, and understanding the legal boundaries around wildlife.',
  },
  {
    slug: 'rodents-in-the-walls',
    title: 'Rodents in the Walls',
    runtime: '9 chapters · about 2.0 hours',
    description: 'A Western Cape Breton guide to identifying, excluding, repairing after, and safely cleaning up around squirrels and other rodents.',
  },
  {
    slug: 'the-new-deal',
    title: 'The New Deal',
    runtime: '9 chapters · about 1.9 hours',
    description: 'A plain-language guide to the 2026 Canada Post and CUPW agreements, their restructuring context, and what the changes could mean for rural mail.',
  },
];

const cards = [...html.matchAll(/<article class="learn-book-card">([\s\S]*?)<\/article>/g)].map((match) => match[1]);

for (const book of approvedBooks) {
  test(`learn page locks approved metadata and links for ${book.title}`, () => {
    assert.equal(count(`<h3>${book.title}</h3>`), 1, `${book.title} title must appear once`);
    const matchingCards = cards.filter((card) => card.includes(`<h3>${book.title}</h3>`));
    assert.equal(matchingCards.length, 1, `${book.title} must occupy one book card`);
    const card = matchingCards[0];

    assert.ok(card.includes(`<p class="learn-book-runtime">${book.runtime}</p>`));
    assert.ok(card.includes(`<p>${book.description}</p>`));

    const expectedLinks = [
      `<a href="${publicLibrary}/tree/main/books/${book.slug}" target="_blank" rel="noopener">Book folder</a>`,
      `<a href="${publicLibrary}/raw/main/books/${book.slug}/${book.slug}.epub">EPUB</a>`,
      `<a href="${publicLibrary}/blob/main/books/${book.slug}/${book.slug}.md" target="_blank" rel="noopener">Read</a>`,
    ];
    const actualLinks = [...card.matchAll(/<a\b[^>]*>[^<]+<\/a>/g)].map((match) => match[0]);
    assert.deepEqual(actualLinks, expectedLinks);
  });
}

test('private books remain absent from learn', () => {
  assert.doesNotMatch(html, /The Long Route/);
  assert.doesNotMatch(html, /The Living Knowledge Base/);
});
