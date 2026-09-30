// "Est-ce que ça rentre ?" — the public, puzzle-shaped entry to PACKSHIFT.
//
// Pure data + rules (no DOM, no words — all copy lives in i18n.js), so it is
// unit-tested alongside the solver.
// Truth boundary: the rules are simplified demo rules, not regulation.

import {
  ALL_KINDS,
  MARKETS,
  NOMINAL_DIMS,
  clampDims,
  isValidForm,
  sloganWeight,
  solvePlacements,
} from '../model/pressure.js';

export const FACE_ORDER = ['FRONT', 'LEFT_COPY', 'RIGHT_DATA', 'BACK'];

// One "size step" grows the carton uniformly: +2 mm wide, +1 mm deep, +2 mm tall.
export const SIZE_MIN = -6;
export const SIZE_MAX = 8;
export function sizeDims(step = 0) {
  return clampDims({
    width: NOMINAL_DIMS.width + 2 * step,
    depth: NOMINAL_DIMS.depth + step,
    height: NOMINAL_DIMS.height + 2 * step,
  });
}

// Smallest size step (within the slider range) for which the brief fits.
export function minimalStep(kinds, market, opts) {
  const brief = Object.fromEntries(kinds.map((k) => [k, null]));
  for (let s = SIZE_MIN; s <= SIZE_MAX; s += 1) {
    if (solvePlacements(brief, market, sizeDims(s), opts).valid) return s;
  }
  return null;
}

export const LEVELS = [
  {
    id: 1,
    market: 'EU',
    kinds: ['claim', 'data', 'language'],
    step: 0,
  },
  {
    id: 2,
    market: 'CANADA',
    kinds: ['claim', 'data', 'language'],
    step: 0,
  },
  {
    id: 3,
    market: 'EU',
    kinds: ['claim', 'data', 'language', 'warning', 'eco', 'barcode'],
    step: 0,
  },
  {
    id: 4,
    market: 'EU',
    kinds: ['claim', 'data', 'language', 'warning', 'barcode'],
    step: 0,
    sizing: 'shrink',
  },
  {
    id: 5,
    market: 'CANADA',
    kinds: ['claim', 'data', 'language', 'warning', 'eco', 'barcode'],
    step: 0,
    sizing: 'grow',
  },
];

export const levelById = (id) => LEVELS.find((l) => l.id === Number(id)) || null;

/* ------------------------------ daily ------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// Same puzzle for everyone on a given day: a market, 4–6 stickers, and the
// tightest box that still has a solution (so it is always solvable, never easy).
export function dailyLevel(key = todayKey()) {
  const rand = mulberry32(Number(key) || 1);
  const markets = Object.keys(MARKETS);
  const market = markets[Math.floor(rand() * markets.length)];
  const extras = ALL_KINDS.filter((k) => !['claim', 'language', 'data'].includes(k));
  const count = 1 + Math.floor(rand() * extras.length); // 1..3 extras
  // Fisher–Yates: identical on every JS engine (a random sort comparator is not).
  const shuffled = [...extras];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const kinds = ['claim', 'language', 'data', ...shuffled.slice(0, count)];
  const step = minimalStep(kinds, market) ?? 0;
  return { id: 'daily', key, market, kinds, step };
}

/* ---------------------------- your box ----------------------------- */

export const SANDBOX = {
  id: 'boite',
  market: 'EU',
  kinds: ['claim', 'data', 'language', 'warning', 'barcode'],
  step: 0,
  sizing: 'free',
};

export const NAME_MAX = 18;
export const SLOGAN_MAX = 70;

export function brandOpts(brand, market = 'EU') {
  if (!brand?.slogan) return undefined;
  return { weights: { claim: sloganWeight(brand.slogan, market) } };
}

/* ----------------------------- scoring ----------------------------- */

export function solved(level, placements, step, opts) {
  return isValidForm(placements, level.market, sizeDims(step), opts);
}

// Stars: placement levels reward few moves; sizing levels reward the size.
export function starsFor(level, { moves, step, hints = 0 }, opts) {
  let stars;
  if (level.sizing) {
    const best = minimalStep(level.kinds, level.market, opts);
    const gap = Math.abs(step - (best ?? step));
    stars = gap === 0 ? 3 : gap <= 1 ? 2 : 1;
  } else {
    const par = level.kinds.length;
    stars = moves <= par ? 3 : moves <= par + 3 ? 2 : 1;
  }
  return Math.max(1, stars - hints);
}

export function formatTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ------------------------------- links ----------------------------- */

// #jeu=3 · #defi=20260930 · #boite=NOM~SLOGAN ; optional &vs=moves.seconds.step
// and &l=<lang> (the sender's language, used only as a fallback).
export function encodeGameHash({ level, brand, result, lang }) {
  const params = new URLSearchParams();
  if (level.id === 'daily') params.set('defi', level.key);
  else if (level.id === 'boite') params.set('boite', `${brand?.name || ''}~${brand?.slogan || ''}`);
  else params.set('jeu', String(level.id));
  if (result) params.set('vs', `${result.moves}.${Math.round(result.ms / 1000)}.${result.step}`);
  if (lang) params.set('l', lang);
  return params.toString();
}

export function decodeGameHash(hash) {
  const raw = (hash || '').replace(/^#/, '');
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  let level = null;
  let brand = null;
  if (params.get('defi') && /^\d{8}$/.test(params.get('defi'))) level = dailyLevel(params.get('defi'));
  else if (params.has('boite')) {
    const raw = params.get('boite');
    const cut = raw.indexOf('~');
    const name = cut < 0 ? raw : raw.slice(0, cut);
    const slogan = cut < 0 ? '' : raw.slice(cut + 1);
    brand = { name: name.slice(0, NAME_MAX), slogan: slogan.slice(0, SLOGAN_MAX) };
    level = SANDBOX;
  } else if (params.get('jeu')) level = levelById(params.get('jeu'));
  if (!level) return null;
  let rival = null;
  const vs = (params.get('vs') || '').split('.').map(Number);
  if (vs.length === 3 && vs.every(Number.isFinite)) rival = { moves: vs[0], seconds: vs[1], step: vs[2] };
  const lang = /^[a-z]{2}$/.test(params.get('l') || '') ? params.get('l') : null;
  return { level, brand, rival, lang };
}
