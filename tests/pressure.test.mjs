import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_KINDS,
  IMPOSSIBLE_FRONT,
  NOMINAL_DIMS,
  capacityFor,
  clampDims,
  suggestDims,
  KINDS,
  MARKETS,
  SURFACES,
  buildPressure,
  emptyPlacements,
  isValidForm,
  overloadedSurfaces,
  ruleViolations,
  solvePlacements,
} from '../src/model/pressure.js';

test('empty brief only carries base load and never overloads', () => {
  for (const market of Object.keys(MARKETS)) {
    const p = buildPressure(emptyPlacements(), market);
    for (const s of SURFACES) assert.ok(p[s] > 0 && p[s] < 1, `${market} ${s}`);
    assert.deepEqual(overloadedSurfaces(p), []);
  }
});

test('Impossible Front overloads only the front, in every market', () => {
  for (const market of Object.keys(MARKETS)) {
    const p = buildPressure(IMPOSSIBLE_FRONT, market);
    assert.deepEqual(overloadedSurfaces(p), ['FRONT'], market);
  }
});

test('solver resolves Impossible Front to a valid form with the claim kept on front', () => {
  for (const market of Object.keys(MARKETS)) {
    const result = solvePlacements(IMPOSSIBLE_FRONT, market);
    assert.equal(result.valid, true, market);
    assert.equal(result.placements.claim, 'FRONT');
    assert.ok(isValidForm(result.placements, market));
    assert.ok(result.moves.length >= 2, 'at least two requirements must leave the front');
  }
});

test('market changes the compiled layout (bilingual copy goes to the back in Canada)', () => {
  const eu = solvePlacements(IMPOSSIBLE_FRONT, 'EU').placements;
  const ca = solvePlacements(IMPOSSIBLE_FRONT, 'CANADA').placements;
  assert.equal(eu.language, 'LEFT_COPY');
  assert.equal(ca.language, 'BACK');
  assert.equal(eu.data, 'RIGHT_DATA');
  assert.equal(ca.data, 'RIGHT_DATA');
});

test('solver keeps a user layout that is already valid', () => {
  const user = { language: 'BACK', data: 'RIGHT_DATA', claim: 'FRONT' };
  const result = solvePlacements(user, 'EU');
  assert.deepEqual(result.placements, user);
  assert.deepEqual(result.moves, []);
});

test('solver places requirements the user has not placed yet', () => {
  const result = solvePlacements({ language: null, data: 'FRONT', claim: null }, 'EU');
  for (const kind of KINDS) assert.ok(result.placements[kind]);
  assert.ok(result.valid);
});

test('claim away from the principal display is a rule violation', () => {
  assert.deepEqual(
    ruleViolations({ language: null, data: null, claim: 'BACK' }, 'EU'),
    [{ kind: 'claim', surface: 'BACK' }],
  );
});

const fullBrief = () => Object.fromEntries(ALL_KINDS.map((k) => [k, null]));

test('the full six-requirement brief fits the nominal carton in the EU', () => {
  const result = solvePlacements(fullBrief(), 'EU');
  assert.equal(result.valid, true);
  assert.equal(result.placements.claim, 'FRONT');
  assert.notEqual(result.placements.barcode, 'FRONT');
});

test('the full brief does NOT fit the nominal carton in Canada — and a bigger carton fixes it', () => {
  assert.equal(solvePlacements(fullBrief(), 'CANADA').valid, false);
  const bigger = suggestDims(fullBrief(), 'CANADA', NOMINAL_DIMS);
  assert.ok(bigger, 'a larger carton within limits should resolve it');
  assert.ok(bigger.width > NOMINAL_DIMS.width || bigger.height > NOMINAL_DIMS.height);
  assert.equal(solvePlacements(fullBrief(), 'CANADA', bigger).valid, true);
});

test('capacity scales with panel area and dimensions are clamped', () => {
  const nominal = capacityFor('EU', NOMINAL_DIMS);
  const wide = capacityFor('EU', { width: 70, depth: 36, height: 130 });
  assert.ok(wide.FRONT > nominal.FRONT);
  assert.equal(wide.LEFT_COPY, nominal.LEFT_COPY);
  assert.deepEqual(clampDims({ width: 10, depth: 99, height: 130 }), { width: 44, depth: 48, height: 130 });
});

test('US market resolves the core brief to a valid form', () => {
  assert.equal(solvePlacements(IMPOSSIBLE_FRONT, 'US').valid, true);
});
