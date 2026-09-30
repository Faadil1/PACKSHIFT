import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS,
  SANDBOX,
  brandOpts,
  dailyLevel,
  decodeGameHash,
  encodeGameHash,
  minimalStep,
  sizeDims,
  solved,
  starsFor,
} from '../src/game/levels.js';
import { NOMINAL_DIMS, solvePlacements } from '../src/model/pressure.js';

const blank = (level) => Object.fromEntries(level.kinds.map((k) => [k, null]));

test('size step 0 is the nominal carton', () => {
  assert.deepEqual(sizeDims(0), NOMINAL_DIMS);
});

test('every placement level is solvable at its starting size', () => {
  for (const level of LEVELS.filter((l) => !l.sizing)) {
    const s = solvePlacements(blank(level), level.market, sizeDims(level.step));
    assert.equal(s.valid, true, `level ${level.id}`);
    assert.equal(solved(level, s.placements, level.step), true);
  }
});

test('level 5 is impossible at the start and becomes possible one step bigger', () => {
  const level = LEVELS.find((l) => l.id === 5);
  assert.equal(solvePlacements(blank(level), level.market, sizeDims(0)).valid, false);
  assert.equal(minimalStep(level.kinds, level.market), 1);
});

test('level 4 can shrink below the nominal carton', () => {
  const level = LEVELS.find((l) => l.id === 4);
  assert.ok(minimalStep(level.kinds, level.market) < 0);
});

test('solvability is monotonic in size (bigger never breaks a solvable brief)', () => {
  for (const level of LEVELS) {
    const best = minimalStep(level.kinds, level.market);
    for (let s = best; s <= 8; s += 1) {
      assert.equal(solvePlacements(blank(level), level.market, sizeDims(s)).valid, true, `level ${level.id} step ${s}`);
    }
  }
});

test('the daily puzzle is deterministic, solvable and different across days', () => {
  const a = dailyLevel('20260930');
  assert.deepEqual(dailyLevel('20260930'), a);
  assert.equal(solvePlacements(blank(a), a.market, sizeDims(a.step)).valid, true);
  const week = ['20261001', '20261002', '20261003', '20261004', '20261005'].map((k) => dailyLevel(k));
  assert.ok(new Set(week.map((d) => d.market + d.kinds.join())).size > 1);
});

test('a longer slogan weighs more; a very long one fits no box at all', () => {
  const short = brandOpts({ slogan: 'Doux comme un nuage' });
  const long = brandOpts({ slogan: 'Une crème si douce que ta peau te dit merci chaque matin' });
  assert.ok(long.weights.claim > short.weights.claim);
  assert.notEqual(minimalStep(SANDBOX.kinds, 'EU', short), null);
  assert.equal(minimalStep(SANDBOX.kinds, 'EU', long), null);
});

test('stars: par moves = 3, hints cost a star; sizing levels reward the size', () => {
  const l1 = LEVELS[0];
  assert.equal(starsFor(l1, { moves: 3, step: 0 }), 3);
  assert.equal(starsFor(l1, { moves: 6, step: 0 }), 2);
  assert.equal(starsFor(l1, { moves: 12, step: 0 }), 1);
  assert.equal(starsFor(l1, { moves: 3, step: 0, hints: 1 }), 2);
  const l5 = LEVELS[4];
  assert.equal(starsFor(l5, { moves: 20, step: 1 }), 3);
  assert.equal(starsFor(l5, { moves: 6, step: 4 }), 1);
});

test('challenge links round-trip level, box and rival score', () => {
  const daily = dailyLevel('20260930');
  const d = decodeGameHash('#' + encodeGameHash({ level: daily, result: { moves: 7, ms: 42000, step: -2 } }));
  assert.equal(d.level.key, '20260930');
  assert.deepEqual(d.rival, { moves: 7, seconds: 42, step: -2 });
  const b = decodeGameHash('#' + encodeGameHash({ level: SANDBOX, brand: { name: 'Nuage', slogan: 'Doux & léger ~ 24h' } }));
  assert.equal(b.brand.name, 'Nuage');
  assert.equal(b.brand.slogan, 'Doux & léger ~ 24h');
  assert.equal(b.level.id, 'boite');
  assert.equal(decodeGameHash('#jeu=3').level.id, 3);
  assert.equal(decodeGameHash('#jeu=99'), null);
  assert.equal(decodeGameHash('#m=EU&b=claim'), null);
});
