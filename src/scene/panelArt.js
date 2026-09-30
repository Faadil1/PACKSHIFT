// Printed panel artwork drawn to canvases so it lives *on* the Blender panels:
// it occludes correctly, follows every fold into the dieline, fades in X-RAY
// and tints in PRESSURE.
//
// Each panel gets three maps:
//  - map:  colour artwork
//  - orm:  roughness (G) / metalness (B) — foil hot-stamping on the logo
//  - bump: embossed product name
//
// Requirement blocks are drawn by one shared renderer, so the same block can
// be printed on any panel, and also rendered alone as the "flying" token that
// travels between panels during COMPILE.
//
// All copy, codes and symbols are fictional concept artwork.

import * as THREE from 'three';
import { NOMINAL_DIMS, REQUIREMENTS, clampDims } from '../model/pressure.js';

const PX_PER_MM = 9;
const INK = '#181611';
const MUTED = '#6d665b';
const RED = '#b73e33';
const BLUE = '#2f5fd0';
const AMBER = '#8a5a12';
const GREEN = '#3f6b3b';
const PAPER = '#f4ede0';
const GOLD = '#a8813f'; // foil-stamped logo base colour

export function panelMM(surface, dims = NOMINAL_DIMS) {
  const d = clampDims(dims);
  return {
    FRONT: [d.width, d.height],
    BACK: [d.width, d.height],
    LEFT_COPY: [d.depth, d.height],
    RIGHT_DATA: [d.depth, d.height],
    TOP: [d.width, d.depth],
  }[surface];
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const mm = (v) => v * PX_PER_MM;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function paper(ctx, w, h, seed) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  const rnd = rng(seed);
  for (let i = 0; i < (w * h) / 700; i += 1) {
    ctx.fillStyle = `rgba(90,70,45,${rnd() * 0.05})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
}

function text(ctx, value, x, y, { size = 3, weight = 400, font = 'Inter, Arial, sans-serif', color = INK, align = 'left', spacing = 0, maxWidth } = {}) {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${weight} ${mm(size)}px ${font}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${mm(spacing)}px`;
  if (maxWidth) ctx.fillText(value, mm(x), mm(y), mm(maxWidth));
  else ctx.fillText(value, mm(x), mm(y));
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function lines(ctx, list, x, y, lead, opts) {
  list.forEach((line, index) => text(ctx, line, x, y + index * lead, opts));
  return list.length * lead;
}

function rule(ctx, x, y, w, color = INK, weight = 0.25) {
  ctx.fillStyle = color;
  ctx.fillRect(mm(x), mm(y), mm(w), mm(weight));
}

function qr(ctx, x, y, size, seed) {
  const cells = 21;
  const cell = size / cells;
  ctx.fillStyle = '#fff';
  ctx.fillRect(mm(x - 1), mm(y - 1), mm(size + 2), mm(size + 2));
  const rnd = rng(seed);
  ctx.fillStyle = INK;
  for (let r = 0; r < cells; r += 1) {
    for (let c = 0; c < cells; c += 1) {
      const finder = (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);
      let on;
      if (finder) {
        const rr = r >= cells - 7 ? r - (cells - 7) : r;
        const cc = c >= cells - 7 ? c - (cells - 7) : c;
        on = rr === 0 || rr === 6 || cc === 0 || cc === 6 || (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4);
      } else on = rnd() > 0.5;
      if (on) ctx.fillRect(mm(x + c * cell), mm(y + r * cell), Math.ceil(mm(cell)), Math.ceil(mm(cell)));
    }
  }
}

function barcode(ctx, x, y, w, h, seed) {
  const rnd = rng(seed);
  let cx = x;
  ctx.fillStyle = INK;
  while (cx < x + w - 0.6) {
    const bar = 0.25 + Math.floor(rnd() * 3) * 0.2;
    ctx.fillRect(mm(cx), mm(y), mm(bar), mm(h));
    cx += bar + 0.25 + Math.floor(rnd() * 2) * 0.3;
  }
}

function recycleMark(ctx, cx, cy, r, color = INK) {
  ctx.strokeStyle = color;
  ctx.lineWidth = mm(0.35);
  for (let i = 0; i < 3; i += 1) {
    const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(mm(cx), mm(cy), mm(r), a + 0.25, a + 1.75);
    ctx.stroke();
  }
}

function hatch(ctx, x, y, w, h, color = RED) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(mm(x), mm(y), mm(w), mm(h));
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = mm(0.3);
  for (let i = -h; i < w; i += 2.2) {
    ctx.beginPath();
    ctx.moveTo(mm(x + i), mm(y + h));
    ctx.lineTo(mm(x + i + h), mm(y));
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = mm(0.35);
  ctx.setLineDash([mm(1.2), mm(0.8)]);
  ctx.strokeRect(mm(x), mm(y), mm(w), mm(h));
  ctx.setLineDash([]);
}

function tag(ctx, label, x, y, align = 'left') {
  text(ctx, label, x, y, { size: 1.6, weight: 700, color: MUTED, spacing: 0.25, align });
}

/* ------------------------------------------------------------------ */
/* Requirement blocks                                                  */
/* ------------------------------------------------------------------ */

// Each returns the height (mm) it used. `w` is the available width in mm.
const BLOCKS = {
  language(ctx, x, y, w, s) {
    text(ctx, 'FR / EN', x, y + 4, { size: 3.6, weight: 800 });
    const copy = w >= 40
      ? ['Crème barrière aux céramides pour', 'peaux sensibles. Ceramide barrier', 'cream for sensitive skin.', 'Usage externe / External use.']
      : ['Complexe aux céramides', 'Ceramide complex', 'Peaux sensibles', 'Sensitive skin'];
    return 6 + lines(ctx, copy, x, y + 9, 2.8, { size: 1.8, font: 'Georgia, serif', maxWidth: w });
  },
  data(ctx, x, y, w, s) {
    const size = Math.min(18, w - 12);
    qr(ctx, x + 1, y + 1, size, s.seed + 7);
    text(ctx, 'SCAN', x + size + 4, y + 5, { size: 1.9, weight: 800, color: BLUE });
    text(ctx, 'RECYCLE', x + size + 4, y + 8, { size: 1.9, weight: 800, color: BLUE });
    recycleMark(ctx, x + size + 7, y + 13.5, 2.4, BLUE);
    return size + 4;
  },
  claim(ctx, x, y, w) {
    if (w >= 30) {
      text(ctx, '24H', x, y + 9, { size: 10, weight: 900, color: RED, spacing: -0.5 });
      text(ctx, 'HYDRATION', x, y + 14, { size: 3.1, weight: 900, color: RED, spacing: 0.2 });
      return 16;
    }
    text(ctx, '24H HYDRATION', x, y + 4, { size: 2.8, weight: 900, color: RED, maxWidth: w });
    return 7;
  },
  warning(ctx, x, y, w, s) {
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = mm(0.35);
    ctx.strokeRect(mm(x), mm(y), mm(w), mm(18));
    text(ctx, s.market === 'CANADA' ? 'WARNINGS / MISES EN GARDE' : 'WARNINGS', x + 2, y + 4.2, { size: 1.9, weight: 800, color: AMBER, maxWidth: w - 4 });
    lines(ctx, [
      'Avoid contact with eyes.',
      'Discontinue use if irritation',
      'occurs. Keep out of reach',
      'of children.',
    ], x + 2, y + 8, 2.5, { size: 1.6, font: 'Georgia, serif', maxWidth: w - 4 });
    return 20;
  },
  eco(ctx, x, y, w) {
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = mm(0.4);
    ctx.beginPath();
    ctx.arc(mm(x + 3.5), mm(y + 3.5), mm(3.2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mm(x + 1.8), mm(y + 5));
    ctx.quadraticCurveTo(mm(x + 3.5), mm(y + 0.8), mm(x + 5.4), mm(y + 2));
    ctx.stroke();
    text(ctx, '−40%', x + 8.5, y + 3.6, { size: 2.6, weight: 900, color: GREEN });
    text(ctx, 'VIRGIN PLASTIC', x + 8.5, y + 6.4, { size: 1.6, weight: 800, color: GREEN, spacing: 0.1, maxWidth: w - 9 });
    return 9;
  },
  barcode(ctx, x, y, w, s) {
    const bw = Math.min(24, w - 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(mm(x), mm(y), mm(bw + 2), mm(13));
    barcode(ctx, x + 1, y + 1, bw, 9, s.seed + 17);
    text(ctx, '5 012345 678900', x + 1 + bw / 2, y + 12.4, { size: 1.6, weight: 600, align: 'center' });
    return 15;
  },
};

function drawBlocks(ctx, kinds, x, y, w, s) {
  let used = 0;
  for (const kind of kinds) {
    used += BLOCKS[kind](ctx, x, y + used, w, s) + 3;
  }
  return used;
}

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */

function drawFront(ctx, s, w, h, orm, bump) {
  const onFront = s.kindsOn.FRONT;
  const over = s.overloaded.includes('FRONT');
  const titleSize = Math.min(12.5, w * 0.22);

  text(ctx, 'NORD', 5, 13, { size: 5, font: 'Georgia, serif', color: GOLD });
  tag(ctx, 'FRONT', w - 5, 7.5, 'right');
  text(ctx, 'HYDRA', 5, 22 + titleSize, { size: titleSize, weight: 800, spacing: -0.7 });
  text(ctx, 'VEIL', 5, 22 + titleSize * 1.9, { size: titleSize, weight: 800, spacing: -0.7 });
  const afterTitle = 22 + titleSize * 1.9;
  text(ctx, 'BARRIER CREAM', 5, afterTitle + 7, { size: 2.7, weight: 800, spacing: 0.25 });
  rule(ctx, 5, afterTitle + 11, 12);

  // Foil: logo is hot-stamped (low roughness, full metalness) + gold ink.
  if (orm) {
    orm.fillStyle = 'rgb(0,56,255)';
    orm.font = `400 ${mm(5)}px Georgia, serif`;
    orm.textBaseline = 'alphabetic';
    orm.fillText('NORD', mm(5), mm(13));
  }
  // Emboss: the product name is raised.
  if (bump) {
    bump.fillStyle = '#fff';
    bump.textBaseline = 'alphabetic';
    bump.font = `800 ${mm(titleSize)}px Inter, Arial, sans-serif`;
    if ('letterSpacing' in bump) bump.letterSpacing = `${mm(-0.7)}px`;
    bump.fillText('HYDRA', mm(5), mm(22 + titleSize));
    bump.fillText('VEIL', mm(5), mm(22 + titleSize * 1.9));
  }

  let y = afterTitle + 17;
  const base = onFront.includes('language')
    ? ['Ceramide complex', 'Complexe aux céramides', 'Sensitive skin', 'Peaux sensibles']
    : ['Ceramide complex', 'Barrier support', 'Sensitive skin'];
  y += lines(ctx, base, 5, y, 3.3, { size: 2.3, font: 'Georgia, serif' }) + 2;

  const others = onFront.filter((k) => k !== 'language');
  const flowTop = y;
  const used = drawBlocks(ctx, others, 5, y, w - 10, s);
  const footer = h - 12;
  if (over) hatch(ctx, 3.5, flowTop - 18, w - 7, Math.max(10, Math.min(footer - flowTop + 16, used + 18)));

  rule(ctx, 5, footer, w - 10, 'rgba(24,22,17,.35)', 0.2);
  const qty = s.market === 'US' ? '1.7 FL OZ · 50 mL' : '50 mL ℮';
  text(ctx, qty, 5, h - 6, { size: 2.6, weight: 600 });
  text(ctx, { EU: 'EU', CANADA: 'CA', US: 'US' }[s.market] || 'EU', w - 5, h - 6, { size: 2.6, weight: 700, align: 'right' });

  if (over) {
    ctx.strokeStyle = RED;
    ctx.lineWidth = mm(0.8);
    ctx.strokeRect(mm(1.5), mm(1.5), mm(w - 3), mm(h - 3));
  }
}

function drawSide(ctx, s, w, h, surface) {
  const kinds = s.kindsOn[surface];
  const over = s.overloaded.includes(surface);
  tag(ctx, surface === 'LEFT_COPY' ? 'LEFT COPY' : 'RIGHT DATA', 4, 7.5);
  let y = 13;
  if (surface === 'LEFT_COPY') {
    text(ctx, 'DIRECTIONS', 4, y + 3, { size: 2.1, weight: 800, spacing: 0.2 });
    y += 4 + lines(ctx, ['Apply morning and evening', 'to clean, dry skin.'], 4, y + 7, 2.8, { size: 1.8, font: 'Georgia, serif', maxWidth: w - 8 });
    if (s.market === 'CANADA') {
      text(ctx, 'MODE D’EMPLOI', 4, y + 6, { size: 2.1, weight: 800, spacing: 0.2 });
      y += 7 + lines(ctx, ['Appliquer matin et soir', 'sur une peau propre.'], 4, y + 10, 2.8, { size: 1.8, font: 'Georgia, serif', maxWidth: w - 8 });
    }
    y += 6;
  } else {
    text(ctx, 'BATCH  L-0919-26', 4, y + 3, { size: 1.9, weight: 700, color: MUTED });
    y += 8;
  }
  const flowTop = y;
  const used = drawBlocks(ctx, kinds, 4, y, w - 8, s);
  if (over) hatch(ctx, 2.5, flowTop - 2, w - 5, Math.min(h - flowTop - 8, used + 4));
  if (surface === 'RIGHT_DATA') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = mm(0.3);
    ctx.strokeRect(mm(4), mm(h - 20), mm(8), mm(7));
    text(ctx, '12M', 8, h - 14.5, { size: 1.8, weight: 800, align: 'center' });
  }
  text(ctx, 'NORD LABS', 4, h - 6, { size: 1.8, weight: 700, spacing: 0.2, color: MUTED });
}

function drawBack(ctx, s, w, h) {
  const kinds = s.kindsOn.BACK;
  const over = s.overloaded.includes('BACK');
  tag(ctx, 'BACK', 5, 7.5);
  text(ctx, s.market === 'US' ? 'INGREDIENTS (INCI)' : 'INGREDIENTS', 5, 16, { size: 2.2, weight: 800, spacing: 0.2 });
  const inci = [
    'Aqua, Glycerin, Caprylic/Capric',
    'Triglyceride, Squalane, Cetearyl',
    'Alcohol, Ceramide NP, Ceramide AP,',
    'Ceramide EOP, Phytosphingosine,',
    'Cholesterol, Carbomer, Xanthan Gum.',
  ];
  let y = 20 + lines(ctx, inci, 5, 20, 2.8, { size: 1.9, font: 'Georgia, serif', maxWidth: w - 10 }) + 3;
  const flowTop = y;
  const used = drawBlocks(ctx, kinds, 5, y, w - 10, s);
  if (over) hatch(ctx, 3.5, flowTop - 2, w - 7, Math.min(h - flowTop - 22, used + 4));
  const responsible = {
    CANADA: ['Distributed by / Distribué par', 'NORD Labs Canada — Montréal QC'],
    US: ['Distributed by', 'NORD Labs Inc. — Brooklyn, NY'],
    EU: ['Responsible person', 'NORD Labs EU — Lyon, France'],
  }[s.market] || [];
  lines(ctx, responsible, 5, h - 14, 2.8, { size: 1.7, color: MUTED, maxWidth: w - 10 });
}

function drawTop(ctx, s, w, h, orm) {
  text(ctx, 'NORD', w / 2, h / 2 + 1, { size: 5, font: 'Georgia, serif', align: 'center', color: GOLD });
  text(ctx, 'LIFT TO OPEN ▸', w / 2, h / 2 + 7, { size: 1.8, weight: 800, align: 'center', color: MUTED, spacing: 0.2 });
  if (orm) {
    orm.fillStyle = 'rgb(0,56,255)';
    orm.textAlign = 'center';
    orm.textBaseline = 'alphabetic';
    orm.font = `400 ${mm(5)}px Georgia, serif`;
    orm.fillText('NORD', mm(w / 2), mm(h / 2 + 1));
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

function makeCanvasTexture(w, h, srgb = true) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(mm(w));
  canvas.height = Math.round(mm(h));
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.userData.canvas = canvas;
  return texture;
}

export function createPanelSet(surface, dims = NOMINAL_DIMS) {
  const [w, h] = panelMM(surface, dims);
  const foil = surface === 'FRONT' || surface === 'TOP';
  return {
    surface,
    size: [w, h],
    map: makeCanvasTexture(w, h),
    orm: foil ? makeCanvasTexture(w, h, false) : null,
    bump: surface === 'FRONT' ? makeCanvasTexture(w, h, false) : null,
    dispose() {
      this.map.dispose();
      this.orm?.dispose();
      this.bump?.dispose();
    },
  };
}

export function paintPanelSet(set, state) {
  const [w, h] = set.size;
  const ctx = set.map.userData.canvas.getContext('2d');
  const seed = hash(set.surface + state.market);
  paper(ctx, ctx.canvas.width, ctx.canvas.height, seed);

  let orm = null;
  if (set.orm) {
    orm = set.orm.userData.canvas.getContext('2d');
    orm.fillStyle = 'rgb(0,220,0)'; // G = roughness 0.86, B = metalness 0
    orm.fillRect(0, 0, orm.canvas.width, orm.canvas.height);
  }
  let bump = null;
  if (set.bump) {
    bump = set.bump.userData.canvas.getContext('2d');
    bump.fillStyle = '#000';
    bump.fillRect(0, 0, bump.canvas.width, bump.canvas.height);
  }

  const s = { ...state, seed };
  if (set.surface === 'FRONT') drawFront(ctx, s, w, h, orm, bump);
  else if (set.surface === 'BACK') drawBack(ctx, s, w, h);
  else if (set.surface === 'TOP') drawTop(ctx, s, w, h, orm);
  else drawSide(ctx, s, w, h, set.surface);

  set.map.needsUpdate = true;
  if (set.orm) set.orm.needsUpdate = true;
  if (set.bump) set.bump.needsUpdate = true;
}

// A single requirement block rendered alone (the token that flies between
// panels during COMPILE). Width in mm follows the destination panel.
export function createBlockTexture(kind, market, widthMM = 30) {
  const probe = document.createElement('canvas').getContext('2d');
  const s = { market, seed: hash(kind + market) };
  // measure height by drawing once on a scratch canvas
  probe.canvas.width = Math.round(mm(widthMM + 4));
  probe.canvas.height = Math.round(mm(40));
  const used = BLOCKS[kind](probe, 2, 2, widthMM, s);
  const hmm = used + 4;
  const texture = makeCanvasTexture(widthMM + 4, hmm);
  const ctx = texture.userData.canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.strokeStyle = REQUIREMENTS[kind].color;
  ctx.lineWidth = mm(0.4);
  ctx.strokeRect(mm(0.3), mm(0.3), mm(widthMM + 3.4), mm(hmm - 0.6));
  BLOCKS[kind](ctx, 2, 2, widthMM, s);
  texture.needsUpdate = true;
  texture.userData.sizeMM = [widthMM + 4, hmm];
  return texture;
}

// Tileable paper-fibre normal map (procedural, no asset download).
let fibreNormal = null;
export function paperFibreNormal() {
  if (fibreNormal) return fibreNormal;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const height = new Float32Array(size * size);
  const rnd = rng(1234);
  for (let f = 0; f < 900; f += 1) {
    let x = rnd() * size;
    let y = rnd() * size;
    const a = rnd() * Math.PI;
    const len = 6 + rnd() * 22;
    for (let i = 0; i < len; i += 1) {
      const xi = ((Math.round(x) % size) + size) % size;
      const yi = ((Math.round(y) % size) + size) % size;
      height[yi * size + xi] += 0.5 + rnd() * 0.5;
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }
  for (let i = 0; i < height.length; i += 1) height[i] += rnd() * 0.35;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const hL = height[y * size + ((x + size - 1) % size)];
      const hR = height[y * size + ((x + 1) % size)];
      const hU = height[((y + size - 1) % size) * size + x];
      const hD = height[((y + 1) % size) * size + x];
      const nx = (hL - hR) * 0.9;
      const ny = (hU - hD) * 0.9;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const o = (y * size + x) * 4;
      img.data[o] = (nx * inv * 0.5 + 0.5) * 255;
      img.data[o + 1] = (ny * inv * 0.5 + 0.5) * 255;
      img.data[o + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  fibreNormal = new THREE.CanvasTexture(canvas);
  fibreNormal.wrapS = THREE.RepeatWrapping;
  fibreNormal.wrapT = THREE.RepeatWrapping;
  fibreNormal.repeat.set(3, 6);
  return fibreNormal;
}

/* Requirement cards (the draggable tokens in the tray) */
export function createCardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = 198;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.userData.canvas = canvas;
  return texture;
}

export function paintCard(texture, { label, sub, color, badge, selected }) {
  const canvas = texture.userData.canvas;
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  ctx.fillStyle = selected ? '#171510' : '#f7f1e6';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = selected ? '#171510' : color;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  const ink = selected ? '#f7f1e6' : color;
  ctx.beginPath();
  ctx.arc(78, h / 2, 44, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = ink;
  if (selected) {
    ctx.fillStyle = ink;
    ctx.fill();
  }
  ctx.stroke();
  ctx.fillStyle = selected ? '#171510' : ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 22px Inter, Arial, sans-serif';
  ctx.fillText(badge, 78, h / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ink;
  let size = 46;
  ctx.font = `800 ${size}px Inter, Arial, sans-serif`;
  while (ctx.measureText(label).width > w - 160 && size > 24) {
    size -= 2;
    ctx.font = `800 ${size}px Inter, Arial, sans-serif`;
  }
  ctx.fillText(label, 140, 98);
  ctx.font = '500 26px Inter, Arial, sans-serif';
  ctx.fillStyle = selected ? '#d9d1c5' : '#6b6459';
  ctx.fillText(sub, 140, 140);
  texture.needsUpdate = true;
}
