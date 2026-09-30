// PACKSHIFT surface pressure model + compile solver.
//
// Truth boundary: every number here is deterministic DEMO logic chosen to make
// the trade-off legible. It is not a regulatory or manufacturing model.

export const SURFACES = ['FRONT', 'LEFT_COPY', 'RIGHT_DATA', 'BACK'];
export const KINDS = ['language', 'data', 'claim'];

export const SURFACE_LABEL = {
  FRONT: 'Front',
  LEFT_COPY: 'Left copy',
  RIGHT_DATA: 'Right data',
  BACK: 'Back',
};

export const REQUIREMENTS = {
  language: { label: 'FR / EN', sub: 'Language copy', color: '#1d1b17', preferred: 'LEFT_COPY' },
  data: { label: 'DATA CARRIER', sub: 'QR / recycling', color: '#2f5fd0', preferred: 'RIGHT_DATA' },
  claim: { label: '24H HYDRATION', sub: 'Marketing claim', color: '#ba3f34', preferred: 'FRONT' },
};

// Per-market demo rules. `base` is information that is always printed
// (identity, fill quantity, ingredients...) and therefore consumes capacity
// before any requirement is placed.
export const MARKETS = {
  EU: {
    label: 'EU',
    capacity: { FRONT: 0.72, LEFT_COPY: 0.68, RIGHT_DATA: 0.64, BACK: 0.88 },
    base: { FRONT: 0.08, LEFT_COPY: 0.1, RIGHT_DATA: 0.06, BACK: 0.3 },
    weight: { language: 0.46, data: 0.34, claim: 0.44 },
    // Claim may not sit away from the principal display; data wants a flat
    // side; language copy is free to move.
    forbidden: { claim: ['LEFT_COPY', 'RIGHT_DATA', 'BACK'] },
  },
  CANADA: {
    label: 'Canada',
    capacity: { FRONT: 0.72, LEFT_COPY: 0.68, RIGHT_DATA: 0.64, BACK: 0.88 },
    // Demo rule: bilingual mandatory statements already occupy the left panel.
    base: { FRONT: 0.1, LEFT_COPY: 0.22, RIGHT_DATA: 0.06, BACK: 0.32 },
    weight: { language: 0.52, data: 0.34, claim: 0.44 },
    forbidden: { claim: ['LEFT_COPY', 'RIGHT_DATA', 'BACK'] },
  },
};

export function emptyPlacements() {
  return { language: null, data: null, claim: null };
}

export function surfaceLoads(placements, market = 'EU') {
  const rules = MARKETS[market] || MARKETS.EU;
  const loads = {};
  for (const surface of SURFACES) {
    loads[surface] = { base: rules.base[surface] || 0, placed: 0, kinds: [] };
  }
  for (const kind of KINDS) {
    const surface = placements[kind];
    if (surface && loads[surface]) {
      loads[surface].placed += rules.weight[kind] || 0;
      loads[surface].kinds.push(kind);
    }
  }
  return loads;
}

export function buildPressure(placements, market = 'EU') {
  const rules = MARKETS[market] || MARKETS.EU;
  const loads = surfaceLoads(placements, market);
  const out = {};
  for (const surface of SURFACES) {
    out[surface] = (loads[surface].base + loads[surface].placed) / rules.capacity[surface];
  }
  return out;
}

export function overloadedSurfaces(pressures) {
  return SURFACES.filter((surface) => pressures[surface] > 1 + 1e-9);
}

export function ruleViolations(placements, market = 'EU') {
  const rules = MARKETS[market] || MARKETS.EU;
  const out = [];
  for (const kind of KINDS) {
    const surface = placements[kind];
    if (surface && rules.forbidden?.[kind]?.includes(surface)) out.push({ kind, surface });
  }
  return out;
}

export function isValidForm(placements, market = 'EU') {
  const allPlaced = KINDS.every((kind) => placements[kind]);
  return (
    allPlaced
    && overloadedSurfaces(buildPressure(placements, market)).length === 0
    && ruleViolations(placements, market).length === 0
  );
}

// Exhaustive search over 4^3 = 64 layouts. Cost favours, in order:
// no overload, no rule violation, keeping the user's own choices, preferred
// surfaces, then balanced headroom. Unplaced requirements are placed too —
// compile always resolves the whole brief.
export function solvePlacements(current, market = 'EU') {
  const rules = MARKETS[market] || MARKETS.EU;
  let best = null;

  const assign = (index, draft) => {
    if (index === KINDS.length) {
      const pressures = buildPressure(draft, market);
      const overflow = SURFACES.reduce((sum, s) => sum + Math.max(0, pressures[s] - 1), 0);
      const violations = ruleViolations(draft, market).length;
      let moves = 0;
      let preference = 0;
      for (const kind of KINDS) {
        if (current[kind] && current[kind] !== draft[kind]) moves += 1;
        if (draft[kind] !== REQUIREMENTS[kind].preferred) preference += 1;
      }
      const peak = Math.max(...SURFACES.map((s) => pressures[s]));
      const cost = overflow * 1000 + violations * 500 + moves * 10 + preference * 3 + peak;
      if (!best || cost < best.cost) best = { cost, placements: { ...draft }, overflow, violations };
      return;
    }
    const kind = KINDS[index];
    for (const surface of SURFACES) {
      draft[kind] = surface;
      assign(index + 1, draft);
    }
  };
  assign(0, {});

  const moves = KINDS
    .filter((kind) => best.placements[kind] !== current[kind])
    .map((kind) => ({ kind, from: current[kind] || null, to: best.placements[kind] }));

  return {
    placements: best.placements,
    moves,
    valid: best.overflow === 0 && best.violations === 0,
    pressures: buildPressure(best.placements, market),
    rules,
  };
}

export const IMPOSSIBLE_FRONT = { language: 'FRONT', data: 'FRONT', claim: 'FRONT' };
