import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOMFixture, installDOM } from '../games/dom-fixture.mjs';
import { renderPassphraseTool } from '../../Resources/tools/passphrase-ui.js';

const createStorage = () => {
  const values = Object.create(null);
  return {
    values,
    getItem(key) { return values[key] ?? null; },
    setItem(key, value) { values[key] = String(value); },
    removeItem(key) { delete values[key]; },
  };
};

const field = (root, name) => {
  const input = root.querySelector(`[name=${name}]`);
  assert.ok(input, `field named ${name} should exist`);
  return input;
};

const change = (root, name, value) => {
  const input = field(root, name);
  input.value = value;
  input.dispatchEvent(new Event('change'));
  return input;
};

const toggle = (root, name, checked) => {
  const input = field(root, name);
  input.checked = checked;
  input.dispatchEvent(new Event('change'));
  return input;
};

const generate = (root) => {
  const button = root.querySelectorAll('button').find((node) => node.textContent === 'Generate');
  assert.ok(button, 'Generate button should exist');
  button.click();
};

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const withTool = (run, {
  storage = createStorage(), clipboard, randomSource, generatePassphraseFn, generateStringFn,
} = {}) => {
  const fixture = createDOMFixture();
  const restore = installDOM(fixture);
  const announcements = [];
  try {
    renderPassphraseTool(fixture.root, {
      storage,
      clipboard,
      randomSource: randomSource ?? ((buffer) => { buffer[0] = 0; }),
      generatePassphraseFn,
      generateStringFn,
      announce: (text) => announcements.push(text),
    });
    const outcome = run({ fixture, storage, announcements });
    if (typeof outcome?.finally === 'function') return outcome.finally(restore);
    restore();
    return outcome;
  } catch (error) {
    restore();
    throw error;
  }
};

test('mounts two pressed-state tabs and an on-demand passphrase form with EFF attribution', () => withTool(({ fixture }) => {
  const tabs = fixture.root.querySelectorAll('.tool-tab');
  assert.equal(tabs.length, 2);
  assert.deepEqual(tabs.map((tab) => tab.textContent), ['Passphrase', 'Random string']);
  assert.deepEqual(tabs.map((tab) => tab.getAttribute('aria-pressed')), ['true', 'false']);
  assert.deepEqual(tabs.map((tab) => tab.classList.contains('is-active')), [true, false]);

  const words = field(fixture.root, 'words');
  assert.deepEqual(words.querySelectorAll('option').map((option) => option.value), ['3', '4', '5', '6', '7', '8']);
  assert.equal(words.value, '5');
  assert.ok(field(fixture.root, 'separator'));
  assert.ok(field(fixture.root, 'capitalize'));
  assert.ok(field(fixture.root, 'includeNumber'));
  assert.equal(fixture.root.querySelector('.tool-result-strong'), null);
  assert.equal(fixture.root.querySelector('.tool-result'), null);
  assert.equal(fixture.root.querySelectorAll('button').some((node) => node.textContent === 'Copy'), false);
  assert.equal(fixture.root.querySelectorAll('p').some((node) => node.textContent === 'Wordlist: EFF large wordlist (CC BY 3.0)'), true);
}));

test('generates passphrases only on demand, rounds entropy, uses inclusive tiers, and persists only options', () => withTool(({ fixture, storage, announcements }) => {
  generate(fixture.root);
  assert.equal(fixture.root.querySelector('.tool-result-strong').textContent, 'abacus-abacus-abacus-abacus-abacus');
  assert.match(fixture.root.querySelector('.tool-result').textContent, /~65 bits.*Good/i);
  assert.match(announcements.at(-1), /good/i);

  change(fixture.root, 'words', '3');
  generate(fixture.root);
  assert.match(fixture.root.querySelector('.tool-result').textContent, /~39 bits.*Weak/i);

  change(fixture.root, 'words', '6');
  generate(fixture.root);
  assert.match(fixture.root.querySelector('.tool-result').textContent, /~78 bits.*Strong/i);

  const preferences = JSON.parse(storage.values['kinnoki-tools:v1']).tools.passphrase;
  assert.deepEqual(preferences, {
    mode: 'passphrase', words: 6, separator: '-', capitalize: false, includeNumber: false,
    length: 20, lower: true, upper: true, digits: true, symbols: false,
  });
  assert.equal(JSON.stringify(preferences).includes('abacus'), false);

  change(fixture.root, 'words', '999');
  generate(fixture.root);
  const error = fixture.root.querySelector('.tool-error');
  assert.ok(error);
  assert.match(error.textContent, /unable to generate/i);
  assert.equal(announcements.at(-1), error.textContent);
}));

test('generates random strings from injected randomness, copies through the injected clipboard, and announces results', async () => {
  const copied = [];
  await withTool(async ({ fixture, storage, announcements }) => {
    fixture.root.querySelectorAll('.tool-tab')[1].click();
    assert.deepEqual(fixture.root.querySelectorAll('.tool-tab').map((tab) => tab.getAttribute('aria-pressed')), ['false', 'true']);
    assert.deepEqual(fixture.root.querySelectorAll('.tool-tab').map((tab) => tab.classList.contains('is-active')), [false, true]);
    change(fixture.root, 'length', '6');
    toggle(fixture.root, 'upper', false);
    toggle(fixture.root, 'digits', false);
    toggle(fixture.root, 'symbols', false);
    generate(fixture.root);

    const result = fixture.root.querySelector('.tool-result-strong');
    assert.equal(result.textContent, 'aaaaaa');
    assert.match(fixture.root.querySelector('.tool-result').textContent, /~28 bits.*Weak/i);
    assert.equal(announcements.at(-1), 'Generated random string — Weak');

    const copy = fixture.root.querySelectorAll('button').find((node) => node.textContent === 'Copy');
    assert.ok(copy);
    copy.click();
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(copied, ['aaaaaa']);
    assert.equal(announcements.at(-1), 'Copied');

    const preferences = JSON.parse(storage.values['kinnoki-tools:v1']).tools.passphrase;
    assert.deepEqual(preferences, {
      mode: 'string', words: 5, separator: '-', capitalize: false, includeNumber: false,
      length: 6, lower: true, upper: false, digits: false, symbols: false,
    });
    assert.equal(JSON.stringify(preferences).includes('aaaaaa'), false);
  }, { clipboard: { writeText: async (value) => { copied.push(value); } } });
});

test('restores passphrase options without rendering a generated value', () => {
  const storage = createStorage();
  storage.setItem('kinnoki-tools:v1', JSON.stringify({
    version: 1,
    tools: {
      passphrase: {
        mode: 'string', words: 8, separator: '_', capitalize: true, includeNumber: true,
        length: 32, lower: false, upper: true, digits: false, symbols: true,
      },
    },
  }));
  withTool(({ fixture }) => {
    assert.deepEqual(fixture.root.querySelectorAll('.tool-tab').map((tab) => tab.getAttribute('aria-pressed')), ['false', 'true']);
    assert.equal(field(fixture.root, 'length').value, '32');
    assert.equal(field(fixture.root, 'lower').checked, false);
    assert.equal(field(fixture.root, 'upper').checked, true);
    assert.equal(field(fixture.root, 'digits').checked, false);
    assert.equal(field(fixture.root, 'symbols').checked, true);
    assert.equal(fixture.root.querySelector('.tool-result-strong'), null);
  }, { storage });
});

test('uses Good at exact 45-bit and 70-bit entropy boundaries', () => {
  const results = [
    { phrase: 'at-forty-five', entropyBits: 45 },
    { phrase: 'at-seventy', entropyBits: 70 },
  ];
  withTool(({ fixture }) => {
    generate(fixture.root);
    assert.equal(fixture.root.querySelector('.tool-result').textContent, '~45 bits — Good');
    generate(fixture.root);
    assert.equal(fixture.root.querySelector('.tool-result').textContent, '~70 bits — Good');
  }, { generatePassphraseFn: () => results.shift() });
});

test('ignores a stale successful copy after a newer generation', async () => {
  const pending = deferred();
  const results = [
    { phrase: 'first-secret', entropyBits: 50 },
    { phrase: 'second-secret', entropyBits: 50 },
  ];
  await withTool(async ({ fixture, announcements }) => {
    generate(fixture.root);
    fixture.root.querySelectorAll('button').find((node) => node.textContent === 'Copy').click();
    generate(fixture.root);
    pending.resolve();
    await settle();

    assert.equal(fixture.root.querySelector('.tool-result-strong').textContent, 'second-secret');
    assert.equal(fixture.root.querySelector('.tool-error'), null);
    assert.equal(announcements.includes('Copied'), false);
  }, {
    clipboard: { writeText: () => pending.promise },
    generatePassphraseFn: () => results.shift(),
  });
});

test('ignores a stale failed copy after a newer generation', async () => {
  const pending = deferred();
  const results = [
    { phrase: 'first-secret', entropyBits: 50 },
    { phrase: 'second-secret', entropyBits: 50 },
  ];
  await withTool(async ({ fixture, announcements }) => {
    generate(fixture.root);
    fixture.root.querySelectorAll('button').find((node) => node.textContent === 'Copy').click();
    generate(fixture.root);
    pending.reject(new Error('clipboard unavailable'));
    await settle();

    assert.equal(fixture.root.querySelector('.tool-result-strong').textContent, 'second-secret');
    assert.equal(fixture.root.querySelector('.tool-error'), null);
    assert.equal(announcements.some((text) => /unable to copy/i.test(text)), false);
  }, {
    clipboard: { writeText: () => pending.promise },
    generatePassphraseFn: () => results.shift(),
  });
});

test('reports a failure when the current generated value cannot be copied', async () => {
  await withTool(async ({ fixture, announcements }) => {
    generate(fixture.root);
    fixture.root.querySelectorAll('button').find((node) => node.textContent === 'Copy').click();
    await settle();

    const error = fixture.root.querySelector('.tool-error');
    assert.ok(error);
    assert.equal(error.textContent, 'Unable to copy the generated value.');
    assert.equal(announcements.at(-1), error.textContent);
  }, { clipboard: { writeText: () => Promise.reject(new Error('clipboard unavailable')) } });
});

test('reports disabled string character sets and manipulated oversized lengths without crashing', () => withTool(({ fixture, announcements }) => {
  fixture.root.querySelectorAll('.tool-tab')[1].click();
  toggle(fixture.root, 'lower', false);
  toggle(fixture.root, 'upper', false);
  toggle(fixture.root, 'digits', false);
  toggle(fixture.root, 'symbols', false);
  generate(fixture.root);
  assert.equal(fixture.root.querySelector('.tool-error').textContent, 'Select at least one character set.');
  assert.equal(announcements.at(-1), 'Select at least one character set.');

  toggle(fixture.root, 'lower', true);
  change(fixture.root, 'length', '1025');
  generate(fixture.root);
  assert.match(fixture.root.querySelector('.tool-error').textContent, /unable to generate/i);
  assert.equal(announcements.at(-1), fixture.root.querySelector('.tool-error').textContent);
}));

test('normalizes invalid persisted passphrase options to safe defaults', () => {
  const storage = createStorage();
  storage.setItem('kinnoki-tools:v1', JSON.stringify({
    version: 1,
    tools: {
      passphrase: {
        mode: 'invalid', words: 2, separator: '/', capitalize: 'yes', includeNumber: 1,
        length: 1025, lower: 'yes', upper: 1, digits: null, symbols: false,
      },
    },
  }));
  withTool(({ fixture }) => {
    assert.deepEqual(fixture.root.querySelectorAll('.tool-tab').map((tab) => tab.getAttribute('aria-pressed')), ['true', 'false']);
    assert.equal(field(fixture.root, 'words').value, '5');
    assert.equal(field(fixture.root, 'separator').value, '-');
    assert.equal(field(fixture.root, 'capitalize').checked, false);
    assert.equal(field(fixture.root, 'includeNumber').checked, false);
    fixture.root.querySelectorAll('.tool-tab')[1].click();
    assert.equal(field(fixture.root, 'length').value, '20');
    assert.equal(field(fixture.root, 'lower').checked, true);
    assert.equal(field(fixture.root, 'upper').checked, true);
    assert.equal(field(fixture.root, 'digits').checked, true);
    assert.equal(field(fixture.root, 'symbols').checked, false);
  }, { storage });
});

test('switching modes clears the generated value and does not multiply Generate listeners', () => {
  let calls = 0;
  withTool(({ fixture }) => {
    generate(fixture.root);
    assert.ok(fixture.root.querySelector('.tool-result-strong'));

    for (const mode of [1, 0, 1, 0]) fixture.root.querySelectorAll('.tool-tab')[mode].click();
    assert.equal(fixture.root.querySelector('.tool-result-strong'), null);
    generate(fixture.root);
    assert.equal(calls, 2);
  }, { generatePassphraseFn: () => ({ phrase: `secret-${++calls}`, entropyBits: 50 }) });
});
