import test from 'node:test';
import assert from 'node:assert/strict';
import { dielineSVG, dielineSegments } from '../src/export/dieline.js';
import { decodeState, encodeState } from '../src/app/urlState.js';
import { NOMINAL_DIMS, solvePlacements, IMPOSSIBLE_FRONT } from '../src/model/pressure.js';

test('dieline: the four body panels are joined by creases, not cuts', () => {
  const { creases, rects } = dielineSegments(NOMINAL_DIMS);
  const body = ['BACK', 'RIGHT_DATA', 'FRONT', 'LEFT_COPY'].map((id) => rects.find((r) => r.id === id));
  for (let i = 0; i < body.length - 1; i += 1) {
    const x = body[i].x + body[i].w;
    const joint = creases.filter((s) => s.o === 'v' && Math.abs(s.c - x) < 0.01);
    const length = joint.reduce((sum, s) => sum + (s.b - s.a), 0);
    assert.ok(Math.abs(length - NOMINAL_DIMS.height) < 0.01, `joint ${body[i].id}|${body[i + 1].id}`);
  }
});

test('dieline: top, tuck and bottom hinge on creases; the outline is cut', () => {
  const { creases, cuts } = dielineSegments(NOMINAL_DIMS);
  assert.ok(creases.length >= 10);
  assert.ok(cuts.length >= 20);
});

test('dieline SVG is millimetre-sized, labelled and honest about its status', () => {
  const solved = solvePlacements(IMPOSSIBLE_FRONT, 'EU');
  const svg = dielineSVG({ dims: NOMINAL_DIMS, market: 'EU', placements: solved.placements, pressures: solved.pressures, valid: true });
  assert.match(svg, /width="\d+mm"/);
  assert.match(svg, /24H HYDRATION/);
  assert.match(svg, /CONCEPT ONLY/);
  assert.match(svg, /class="crease"/);
});

test('URL state round-trips and survives junk', () => {
  const state = {
    market: 'CANADA',
    brief: ['language', 'data', 'claim', 'warning'],
    placements: { language: 'BACK', data: 'RIGHT_DATA', claim: 'FRONT', warning: null },
    dims: { width: 60, depth: 38, height: 134 },
    viewMode: 'DIELINE',
  };
  assert.deepEqual(decodeState('#' + encodeState(state)), state);
  const junk = decodeState('#m=MARS&b=nope,claim&p=Z&d=1x2x3&v=HACK');
  assert.equal(junk.market, 'EU');
  assert.deepEqual(junk.brief, ['claim']);
  assert.deepEqual(junk.placements, { claim: null });
  assert.deepEqual(junk.dims, { width: 44, depth: 34, height: 110 });
  assert.equal(junk.viewMode, 'PACK');
  assert.equal(decodeState(''), null);
});
