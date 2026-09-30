// PACKSHIFT surface pressure model + compile solver.
//
// Truth boundary: every number here is deterministic DEMO logic chosen to make
// trade-offs legible. It is not a regulatory, legal or manufacturing model.

export const SURFACES = ['FRONT', 'LEFT_COPY', 'RIGHT_DATA', 'BACK'];

export const SURFACE_LABEL = {
  FRONT: 'Front',
  LEFT_COPY: 'Left copy',
  RIGHT_DATA: 'Right data',
  BACK: 'Back',
};

// Every requirement the brief can contain. `core` ones form the default brief
// (and the Impossible Front signature); the others can be added by the user.
export const REQUIREMENTS = {
  language: { label: 'FR / EN', sub: 'Language copy', color: '#1d1b17', preferred: 'LEFT_COPY', core: true },
  data: { label: 'DATA CARRIER', sub: 'QR / recycling', color: '#2f5fd0', preferred: 'RIGHT_DATA', core: true },
  claim: { label: '24H HYDRATION', sub: 'Marketing claim', color: '#ba3f34', preferred: 'FRONT', core: true },
  warning: { label: 'WARNINGS', sub: 'Mandatory caution', color: '#8a5a12', preferred: 'BACK', core: false },
  eco: { label: 'ECO CLAIM', sub: '−40% virgin plastic', color: '#3f6b3b', preferred: 'RIGHT_DATA', core: false },
  barcode: { label: 'EAN-13', sub: 'Retail barcode', color: '#4a4640', preferred: 'BACK', core: false },
};

export const ALL_KINDS = Object.keys(REQUIREMENTS);
export const CORE_KINDS = ALL_KINDS.filter((k) => REQUIREMENTS[k].core);
// Backwards-compatible alias: the default brief.
export const KINDS = CORE_KINDS;

// Per-market demo rules. `base` is information that is always printed
// (identity, fill quantity, ingredients...) and consumes capacity before any
// requirement is placed. Capacities are for the nominal 56 x 36 x 130 carton.
const FRONT_ONLY_CLAIM = ['LEFT_COPY', 'RIGHT_DATA', 'BACK'];
export const MARKETS = {
  EU: {
    label: 'EU',
    capacity: { FRONT: 0.72, LEFT_COPY: 0.68, RIGHT_DATA: 0.64, BACK: 0.88 },
    base: { FRONT: 0.08, LEFT_COPY: 0.1, RIGHT_DATA: 0.06, BACK: 0.3 },
    weight: { language: 0.46, data: 0.34, claim: 0.44, warning: 0.26, eco: 0.22, barcode: 0.18 },
    forbidden: { claim: FRONT_ONLY_CLAIM, barcode: ['FRONT'] },
    note: 'Language copy is optional; ingredients sit on the back.',
  },
  CANADA: {
    label: 'Canada',
    capacity: { FRONT: 0.72, LEFT_COPY: 0.68, RIGHT_DATA: 0.64, BACK: 0.88 },
    base: { FRONT: 0.1, LEFT_COPY: 0.22, RIGHT_DATA: 0.06, BACK: 0.32 },
    weight: { language: 0.52, data: 0.34, claim: 0.44, warning: 0.3, eco: 0.22, barcode: 0.18 },
    forbidden: { claim: FRONT_ONLY_CLAIM, barcode: ['FRONT'] },
    note: 'Bilingual mandatory statements already occupy the left panel.',
  },
  US: {
    label: 'US',
    capacity: { FRONT: 0.72, LEFT_COPY: 0.68, RIGHT_DATA: 0.64, BACK: 0.88 },
    base: { FRONT: 0.14, LEFT_COPY: 0.08, RIGHT_DATA: 0.06, BACK: 0.4 },
    weight: { language: 0.3, data: 0.34, claim: 0.44, warning: 0.34, eco: 0.22, barcode: 0.18 },
    forbidden: { claim: FRONT_ONLY_CLAIM, barcode: ['FRONT'] },
    note: 'Dual-unit net quantity on the front; a heavier back facts panel.',
  },
};

export const NOMINAL_DIMS = { width: 56, depth: 36, height: 130 };
export const DIM_LIMITS = {
  width: [44, 72],
  depth: [34, 48], // the 31 mm jar + insert must still fit
  height: [110, 150],
};

export function clampDims(dims = NOMINAL_DIMS) {
  const out = {};
  for (const key of Object.keys(NOMINAL_DIMS)) {
    const [lo, hi] = DIM_LIMITS[key];
    out[key] = Math.round(Math.min(hi, Math.max(lo, Number(dims[key]) || NOMINAL_DIMS[key])));
  }
  return out;
}

export function isNominal(dims) {
  const d = clampDims(dims);
  return d.width === NOMINAL_DIMS.width && d.depth === NOMINAL_DIMS.depth && d.height === NOMINAL_DIMS.height;
}

// Printable capacity scales with panel area.
export function capacityFor(market = 'EU', dims = NOMINAL_DIMS) {
  const rules = MARKETS[market] || MARKETS.EU;
  const d = clampDims(dims);
  const n = NOMINAL_DIMS;
  const front = (d.width * d.height) / (n.width * n.height);
  const side = (d.depth * d.height) / (n.depth * n.height);
  return {
    FRONT: rules.capacity.FRONT * front,
    BACK: rules.capacity.BACK * front,
    LEFT_COPY: rules.capacity.LEFT_COPY * side,
    RIGHT_DATA: rules.capacity.RIGHT_DATA * side,
  };
}

export function emptyPlacements(kinds = CORE_KINDS) {
  return Object.fromEntries(kinds.map((kind) => [kind, null]));
}

function kindsOf(placements) {
  return ALL_KINDS.filter((kind) => Object.prototype.hasOwnProperty.call(placements, kind));
}

export function surfaceLoads(placements, market = 'EU') {
  const rules = MARKETS[market] || MARKETS.EU;
  const loads = {};
  for (const surface of SURFACES) loads[surface] = { base: rules.base[surface] || 0, placed: 0, kinds: [] };
  for (const kind of kindsOf(placements)) {
    const surface = placements[kind];
    if (surface && loads[surface]) {
      loads[surface].placed += rules.weight[kind] || 0;
      loads[surface].kinds.push(kind);
    }
  }
  return loads;
}

export function buildPressure(placements, market = 'EU', dims = NOMINAL_DIMS) {
  const capacity = capacityFor(market, dims);
  const loads = surfaceLoads(placements, market);
  const out = {};
  for (const surface of SURFACES) out[surface] = (loads[surface].base + loads[surface].placed) / capacity[surface];
  return out;
}

export function overloadedSurfaces(pressures) {
  return SURFACES.filter((surface) => pressures[surface] > 1 + 1e-9);
}

export function ruleViolations(placements, market = 'EU') {
  const rules = MARKETS[market] || MARKETS.EU;
  const out = [];
  for (const kind of kindsOf(placements)) {
    const surface = placements[kind];
    if (surface && rules.forbidden?.[kind]?.includes(surface)) out.push({ kind, surface });
  }
  return out;
}

export function isValidForm(placements, market = 'EU', dims = NOMINAL_DIMS) {
  const kinds = kindsOf(placements);
  return (
    kinds.every((kind) => placements[kind])
    && overloadedSurfaces(buildPressure(placements, market, dims)).length === 0
    && ruleViolations(placements, market).length === 0
  );
}

// Exhaustive search over 4^N layouts (N <= 6 -> 4096). Cost favours, in order:
// no overload, no rule violation, keeping the user's own choices, preferred
// surfaces, then balanced headroom. Unplaced requirements are placed too —
// compile always tries to resolve the whole brief, and says so honestly when
// no layout exists.
export function solvePlacements(current, market = 'EU', dims = NOMINAL_DIMS) {
  const rules = MARKETS[market] || MARKETS.EU;
  const kinds = kindsOf(current);
  let best = null;

  const assign = (index, draft) => {
    if (index === kinds.length) {
      const pressures = buildPressure(draft, market, dims);
      const overflow = SURFACES.reduce((sum, s) => sum + Math.max(0, pressures[s] - 1), 0);
      const violations = ruleViolations(draft, market).length;
      let moves = 0;
      let preference = 0;
      for (const kind of kinds) {
        if (current[kind] && current[kind] !== draft[kind]) moves += 1;
        if (draft[kind] !== REQUIREMENTS[kind].preferred) preference += 1;
      }
      const peak = Math.max(...SURFACES.map((s) => pressures[s]));
      const cost = overflow * 1000 + violations * 500 + moves * 10 + preference * 3 + peak;
      if (!best || cost < best.cost) best = { cost, placements: { ...draft }, overflow, violations };
      return;
    }
    const kind = kinds[index];
    for (const surface of SURFACES) {
      draft[kind] = surface;
      assign(index + 1, draft);
    }
  };
  assign(0, {});

  if (!best) best = { placements: {}, overflow: 0, violations: 0 };

  const moves = kinds
    .filter((kind) => best.placements[kind] !== current[kind])
    .map((kind) => ({ kind, from: current[kind] || null, to: best.placements[kind] }));

  const pressures = buildPressure(best.placements, market, dims);
  return {
    placements: best.placements,
    moves,
    valid: best.overflow === 0 && best.violations === 0,
    pressures,
    overloaded: overloadedSurfaces(pressures),
    rules,
  };
}

// Smallest uniform carton growth (in 2 mm steps) that makes the brief
// solvable — used to tell the user *how much bigger* the pack would need to be.
export function suggestDims(current, market = 'EU', dims = NOMINAL_DIMS) {
  const start = clampDims(dims);
  for (let step = 0; step <= 14; step += 1) {
    const candidate = clampDims({
      width: start.width + step * 2,
      depth: start.depth + step,
      height: start.height + step * 2,
    });
    if (solvePlacements(current, market, candidate).valid) return candidate;
  }
  return null;
}

export const IMPOSSIBLE_FRONT = { language: 'FRONT', data: 'FRONT', claim: 'FRONT' };
