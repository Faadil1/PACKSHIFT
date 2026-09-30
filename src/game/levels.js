// "Est-ce que ça rentre ?" — the public, puzzle-shaped entry to PACKSHIFT.
//
// Pure data + rules (no DOM), so it is unit-tested alongside the solver.
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

// Plain words for a person who has never heard of packaging.
export const PLAIN = {
  claim: { name: 'Slogan', why: 'Ce qui fait vendre. Il doit être devant, sinon personne ne le voit.' },
  language: { name: 'Traduction', why: 'La loi exige que tout soit écrit dans la langue du pays.' },
  data: { name: 'QR de tri', why: 'Explique comment recycler la boîte. Obligatoire en France.' },
  warning: { name: 'Attention', why: 'Les précautions d’usage : « éviter le contact avec les yeux »…' },
  eco: { name: 'Écolo', why: 'La marque veut montrer que son emballage est plus vert.' },
  barcode: { name: 'Code-barres', why: 'Sans lui, la caisse ne peut pas scanner le produit.' },
};

export const FACE = {
  FRONT: 'Devant',
  LEFT_COPY: 'Gauche',
  RIGHT_DATA: 'Droite',
  BACK: 'Dos',
};
export const FACE_ORDER = ['FRONT', 'LEFT_COPY', 'RIGHT_DATA', 'BACK'];

// What is already printed on each face before any sticker (MARKETS.base),
// in plain words.
export const ALREADY = {
  EU: { FRONT: 'nom + contenance', LEFT_COPY: 'mode d’emploi', RIGHT_DATA: 'n° de lot', BACK: 'ingrédients' },
  CANADA: { FRONT: 'nom + contenance', LEFT_COPY: 'mode d’emploi FR + EN', RIGHT_DATA: 'n° de lot', BACK: 'ingrédients' },
  US: { FRONT: 'nom + 1.7 fl oz / 50 mL', LEFT_COPY: 'mode d’emploi', RIGHT_DATA: 'n° de lot', BACK: 'tableau « facts »' },
};

export const MARKET_PLAIN = { EU: 'en France', CANADA: 'au Canada', US: 'aux États-Unis' };

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
export const cm = (mm) => (mm / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' cm';

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
    title: 'Le premier pot',
    market: 'EU',
    kinds: ['claim', 'data', 'language'],
    step: 0,
    goal: 'Colle les 3 étiquettes sur la boîte. Rien ne doit déborder.',
    rules: ['Le slogan va devant'],
    fact: 'Sur une vraie boîte, presque chaque mot est imposé par la loi ou par la marque.',
  },
  {
    id: 2,
    title: 'Direction le Canada',
    market: 'CANADA',
    kinds: ['claim', 'data', 'language'],
    step: 0,
    goal: 'Même boîte, mais au Canada. Attention : la gauche est déjà pleine.',
    rules: ['Le slogan va devant', 'Tout est écrit en français ET en anglais'],
    fact: 'Au Canada, les mentions sont bilingues : le même texte prend deux fois plus de place.',
  },
  {
    id: 3,
    title: 'Tout le monde veut être vu',
    market: 'EU',
    kinds: ['claim', 'data', 'language', 'warning', 'eco', 'barcode'],
    step: 0,
    goal: '6 étiquettes, 4 faces. Trouve la place de chacune.',
    rules: ['Le slogan va devant', 'Pas de code-barres devant'],
    fact: 'Le code-barres est presque toujours au dos : devant, il gâcherait la vitrine.',
  },
  {
    id: 4,
    title: 'La marque veut plus petit',
    market: 'EU',
    kinds: ['claim', 'data', 'language', 'warning', 'barcode'],
    step: 0,
    sizing: 'shrink',
    goal: 'Moins de carton = moins cher et plus écolo. Rétrécis la boîte au maximum, sans que rien ne déborde.',
    rules: ['Le slogan va devant', 'Pas de code-barres devant'],
    fact: 'Chaque millimètre de carton économisé, multiplié par des millions de boîtes, compte.',
  },
  {
    id: 5,
    title: 'Mission impossible ?',
    market: 'CANADA',
    kinds: ['claim', 'data', 'language', 'warning', 'eco', 'barcode'],
    step: 0,
    sizing: 'grow',
    goal: '6 étiquettes, au Canada. Essaie… puis agrandis la boîte le moins possible.',
    rules: ['Le slogan va devant', 'Pas de code-barres devant', 'Tout en français ET en anglais'],
    fact: 'Voilà pourquoi certaines boîtes sont plus grandes que le pot : il faut de la place pour tout ce qu’on est obligé d’écrire.',
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
  const pretty = `${key.slice(6, 8)}/${key.slice(4, 6)}`;
  return {
    id: 'daily',
    key,
    title: `Défi du ${pretty}`,
    market,
    kinds,
    step,
    goal: `La boîte la plus serrée possible, ${MARKET_PLAIN[market]}. Tout le monde a la même aujourd’hui.`,
    rules: ['Le slogan va devant', ...(kinds.includes('barcode') ? ['Pas de code-barres devant'] : [])],
    fact: 'Demain, un nouveau défi. Même boîte pour tout le monde : compare tes coups.',
  };
}

/* ---------------------------- your box ----------------------------- */

export const SANDBOX = {
  id: 'boite',
  title: 'Ta boîte',
  market: 'EU',
  kinds: ['claim', 'data', 'language', 'warning', 'barcode'],
  step: 0,
  sizing: 'free',
  goal: 'Invente ton produit. Si ton slogan est trop long… il ne rentrera pas.',
  rules: ['Le slogan va devant', 'Pas de code-barres devant'],
  fact: 'Les slogans courts ne sont pas qu’une mode : la face avant est minuscule.',
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
export function encodeGameHash({ level, brand, result }) {
  const params = new URLSearchParams();
  if (level.id === 'daily') params.set('defi', level.key);
  else if (level.id === 'boite') params.set('boite', `${brand?.name || ''}~${brand?.slogan || ''}`);
  else params.set('jeu', String(level.id));
  if (result) params.set('vs', `${result.moves}.${Math.round(result.ms / 1000)}.${result.step}`);
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
  return { level, brand, rival };
}
