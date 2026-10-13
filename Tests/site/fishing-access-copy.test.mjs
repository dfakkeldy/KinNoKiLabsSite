import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../Resources/fishing/data/spots.json', import.meta.url), 'utf8');
const generated = readFileSync(new URL('../../Output/fishing/data/spots.json', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../Resources/fishing/index.html', import.meta.url), 'utf8');
const spots = new Map(JSON.parse(source).features.map(({ properties }) => [properties.id, properties]));
const unverifiedRoadsidePins = ['S02', 'S03', 'S06', 'S07', 'S08', 'S09', 'S12', 'S15', 'S21', 'S22', 'S23', 'S26', 'S27', 'S28'];

test('roadside cards leave access unverified instead of applying a general land-access right at a pin', () => {
  for (const id of unverifiedRoadsidePins) {
    assert.match(spots.get(id).access, /not been verified/i, id);
    assert.doesNotMatch(spots.get(id).access, /In season, Nova Scotia residents may walk|\(Angling Act\)/, id);
    assert.doesNotMatch(spots.get(id).access, /fish from the road allowance|fish from the road edge/i, id);
  }
});

test('S08 fishing advice depends on confirmed shore access and does not invite road-edge casting', () => {
  assert.match(spots.get('S08').tip, /confirmed lawful shore access/i);
  assert.doesNotMatch(spots.get('S08').tip, /from the road edge|road allowance/i);
});

test('harbour advice preserves unverified rules, ownership and intended-use permission', () => {
  for (const id of ['S03', 'S15']) {
    assert.match(spots.get(id).access, /harbour.*fishing rules.*not been verified/i, id);
    assert.match(spots.get(id).tip, /access and fishing use have been confirmed/i, id);
  }
  assert.match(spots.get('S15').access, /breakwater.*ownership.*not been verified/i);
  assert.doesNotMatch(spots.get('S15').access, /Use the breakwater only if it is not posted closed/);
  assert.match(spots.get('S15').access, /absence of a closure sign does not establish permission/i);
});

test('the page makes no blanket legal-spot promise and states the general foot-access conditions separately', () => {
  assert.equal(/good legal shore spots/i.test(html), false, 'no blanket legal-spot promise');
  for (const condition of [/Nova Scotia residents/, /on foot/, /river, stream or lake/, /uncultivated or Crown land/, /lawful rod-and-line fishing/, /natural wild state/, /actual damage/, /does not grant a right to light fires/]) {
    assert.equal(condition.test(html), true, `footer includes ${condition}`);
  }
  assert.equal(/does not verify access at any pin/i.test(html), true, 'no pin-specific access verification');
  assert.equal(/nslegislature\.ca\/sites\/default\/files\/legc\/statutes\/angling\.pdf/.test(html), true, 'verified primary Act citation');
});

test('published guide resources exactly match their generated counterparts', () => {
  assert.equal(generated === source, true, 'generated spots match source bytes');
  assert.equal(readFileSync(new URL('../../Output/fishing/index.html', import.meta.url), 'utf8') === html, true, 'generated HTML matches source bytes');
});
