// Shareable studio state in the URL hash, e.g.
//   #m=CANADA&b=language,data,claim,warning&p=FRONT.FRONT.FRONT.BACK&d=56x36x130&v=PACK
//
// Placements are stored in brief order, one surface code per requirement
// (F/L/R/B, or "-" for unplaced). Everything is validated on read, so a
// hand-edited or stale link degrades to defaults instead of breaking the app.

import { ALL_KINDS, CORE_KINDS, MARKETS, SURFACES, clampDims, NOMINAL_DIMS } from '../model/pressure.js';

const CODE = { FRONT: 'F', LEFT_COPY: 'L', RIGHT_DATA: 'R', BACK: 'B' };
const DECODE = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
const VIEWS = ['PACK', 'EXPLODED', 'DIELINE', 'XRAY', 'PRESSURE'];

export function encodeState({ market, brief, placements, dims, viewMode }) {
  const params = new URLSearchParams();
  params.set('m', market);
  params.set('b', brief.join(','));
  params.set('p', brief.map((k) => (placements[k] ? CODE[placements[k]] : '-')).join(''));
  const d = clampDims(dims);
  params.set('d', `${d.width}x${d.depth}x${d.height}`);
  if (VIEWS.includes(viewMode)) params.set('v', viewMode);
  return params.toString();
}

export function decodeState(hash) {
  const raw = (hash || '').replace(/^#/, '');
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const market = MARKETS[params.get('m')] ? params.get('m') : 'EU';
  let brief = (params.get('b') || '').split(',').filter((k) => ALL_KINDS.includes(k));
  brief = [...new Set(brief)];
  if (brief.length === 0) brief = [...CORE_KINDS];
  const codes = (params.get('p') || '').split('');
  const placements = {};
  brief.forEach((kind, i) => {
    const surface = DECODE[codes[i]];
    placements[kind] = SURFACES.includes(surface) ? surface : null;
  });
  const [w, dd, h] = (params.get('d') || '').split('x').map(Number);
  const dims = clampDims({ width: w || NOMINAL_DIMS.width, depth: dd || NOMINAL_DIMS.depth, height: h || NOMINAL_DIMS.height });
  const viewMode = VIEWS.includes(params.get('v')) ? params.get('v') : 'PACK';
  return { market, brief, placements, dims, viewMode };
}
