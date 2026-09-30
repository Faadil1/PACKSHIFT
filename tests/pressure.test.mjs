import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IMPOSSIBLE_FRONT,
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
