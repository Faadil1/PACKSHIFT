// Printed panel artwork drawn to CanvasTextures so it lives *on* the Blender
// panels: it occludes correctly, follows every fold into the dieline, fades in
// X-RAY and tints in PRESSURE. Replaces the previous DOM overlay, which floated
// above the canvas and showed through the box from behind.
//
// All copy, codes and symbols are fictional concept artwork.

import * as THREE from 'three';

const PX_PER_MM = 9;

export const PANEL_MM = {
  FRONT: [56, 130],
  BACK: [56, 130],
  LEFT_COPY: [36, 130],
  RIGHT_DATA: [36, 130],
  TOP: [56, 36],
};

const INK = '#181611';
const MUTED = '#6d665b';
const RED = '#b73e33';
const BLUE = '#2f5fd0';
const PAPER = '#f4ede0';

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mm(v) {
  return v * PX_PER_MM;
}

function paper(ctx, w, h, seed) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  let s = seed;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 1800; i += 1) {
    ctx.fillStyle = `rgba(90,70,45,${rnd() * 0.05})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
}

function text(ctx, value, x, y, { size = 3, weight = 400, font = 'Inter, Arial, sans-serif', color = INK, align = 'left', spacing = 0 } = {}) {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${weight} ${mm(size)}px ${font}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${mm(spacing)}px`;
  ctx.fillText(value, mm(x), mm(y));
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function lines(ctx, list, x, y, lead, opts) {
  list.forEach((line, index) => text(ctx, line, x, y + index * lead, opts));
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
  let s = seed;
  const bit = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return (s >>> 16) & 1;
  };
  ctx.fillStyle = INK;
  for (let r = 0; r < cells; r += 1) {
    for (let c = 0; c < cells; c += 1) {
      const finder = (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);
      let on;
      if (finder) {
        const rr = r >= cells - 7 ? r - (cells - 7) : r;
        const cc = c >= cells - 7 ? c - (cells - 7) : c;
        on = rr === 0 || rr === 6 || cc === 0 || cc === 6 || (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4);
      } else on = bit();
      if (on) ctx.fillRect(mm(x + c * cell), mm(y + r * cell), Math.ceil(mm(cell)), Math.ceil(mm(cell)));
    }
  }
}

function barcode(ctx, x, y, w, h, seed) {
  let s = seed;
  let cx = x;
  ctx.fillStyle = INK;
  while (cx < x + w) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const bar = 0.25 + ((s >>> 24) % 3) * 0.2;
    ctx.fillRect(mm(cx), mm(y), mm(bar), mm(h));
    cx += bar + 0.25 + ((s >>> 20) % 2) * 0.3;
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
    const ax = cx + Math.cos(a + 1.75) * r;
    const ay = cy + Math.sin(a + 1.75) * r;
    ctx.beginPath();
    ctx.moveTo(mm(ax), mm(ay));
    ctx.lineTo(mm(ax + Math.cos(a + 1.75 + 2.4) * 1.2), mm(ay + Math.sin(a + 1.75 + 2.4) * 1.2));
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

function tag(ctx, label, x, y, color, align = 'left') {
  text(ctx, label, x, y, { size: 1.6, weight: 700, color, spacing: 0.25, align });
}

function drawFront(ctx, s) {
  const onFront = s.kindsOn.FRONT;
  const language = onFront.includes('language');
  const data = onFront.includes('data');
  const claim = onFront.includes('claim');
  const over = s.overloaded.includes('FRONT');

  text(ctx, 'NORD', 5, 13, { size: 5, font: 'Georgia, serif' });
  tag(ctx, 'FRONT', 51, 7.5, MUTED, 'right');
  ctx.textAlign = 'left';
  text(ctx, 'HYDRA', 5, 32, { size: 12.5, weight: 800, spacing: -0.7 });
  text(ctx, 'VEIL', 5, 43, { size: 12.5, weight: 800, spacing: -0.7 });
  text(ctx, 'BARRIER CREAM', 5, 50, { size: 2.7, weight: 800, spacing: 0.25 });
  rule(ctx, 5, 54, 12);

  const copy = language
    ? ['Ceramide complex', 'Complexe aux céramides', 'Sensitive skin', 'Peaux sensibles']
    : ['Ceramide complex', 'Barrier support', 'Sensitive skin'];
  lines(ctx, copy, 5, 60, 3.3, { size: 2.3, font: 'Georgia, serif' });

  if (claim) {
    const y = over ? 84 : 100;
    text(ctx, '24H', 5, y, { size: 10, weight: 900, color: RED, spacing: -0.5 });
    text(ctx, 'HYDRATION', 5, y + 5, { size: 3.1, weight: 900, color: RED, spacing: 0.2 });
    if (over) hatch(ctx, 3.5, y - 9, 30, 16);
  }
  if (data) {
    qr(ctx, over ? 30 : 36, over ? 76 : 97, 15, s.seed);
    if (over) hatch(ctx, 28.5, 74.5, 18, 18, BLUE);
  }
  if (language && over) hatch(ctx, 3.5, 56.5, 44, 13, INK);

  rule(ctx, 5, 118, 46, 'rgba(24,22,17,.35)', 0.2);
  text(ctx, '50 mL ℮', 5, 124, { size: 2.6, weight: 600 });
  text(ctx, s.market === 'CANADA' ? 'CA' : 'EU', 51, 124, { size: 2.6, weight: 700, align: 'right' });

  if (over) {
    ctx.strokeStyle = RED;
    ctx.lineWidth = mm(0.8);
    ctx.strokeRect(mm(1.5), mm(1.5), mm(53), mm(127));
  }
}

function drawLeft(ctx, s) {
  const onLeft = s.kindsOn.LEFT_COPY;
  const over = s.overloaded.includes('LEFT_COPY');
  tag(ctx, 'LEFT COPY', 4, 7.5, MUTED);
  let y = 16;
  text(ctx, 'DIRECTIONS', 4, y, { size: 2.1, weight: 800, spacing: 0.2 });
  lines(ctx, ['Apply morning and evening', 'to clean, dry skin.', 'External use only.'], 4, y + 4, 3, { size: 1.9, font: 'Georgia, serif' });
  y += 16;
  if (s.market === 'CANADA') {
    text(ctx, 'MODE D’EMPLOI', 4, y, { size: 2.1, weight: 800, spacing: 0.2 });
    lines(ctx, ['Appliquer matin et soir', 'sur une peau propre.', 'Usage externe seulement.'], 4, y + 4, 3, { size: 1.9, font: 'Georgia, serif' });
    y += 16;
  }
  if (onLeft.includes('language')) {
    rule(ctx, 4, y - 2, 28);
    text(ctx, 'FR / EN', 4, y + 4, { size: 4, weight: 800 });
    lines(ctx, [
      'Complexe aux céramides qui',
      'renforce la barrière cutanée.',
      'Ceramide complex that',
      'reinforces the skin barrier.',
      'Hypoallergénique / Hypoallergenic',
    ], 4, y + 9, 3, { size: 1.8, font: 'Georgia, serif' });
    y += 28;
  }
  if (onLeft.includes('claim')) {
    text(ctx, '24H HYDRATION', 4, y + 4, { size: 3, weight: 900, color: RED });
    y += 10;
  }
  if (onLeft.includes('data')) {
    qr(ctx, 9, y + 2, 16, s.seed + 3);
    y += 22;
  }
  if (over) hatch(ctx, 2.5, 10, 31, Math.min(116, y - 6));
  text(ctx, 'NORD LABS', 4, 124, { size: 1.8, weight: 700, spacing: 0.2, color: MUTED });
}

function drawRight(ctx, s) {
  const onRight = s.kindsOn.RIGHT_DATA;
  const over = s.overloaded.includes('RIGHT_DATA');
  tag(ctx, 'RIGHT DATA', 4, 7.5, MUTED);
  let y = 16;
  if (onRight.includes('data')) {
    qr(ctx, 7, y, 22, s.seed + 7);
    text(ctx, 'SCAN · RECYCLE', 18, y + 27, { size: 1.7, weight: 800, align: 'center', color: BLUE, spacing: 0.15 });
    recycleMark(ctx, 12, y + 36, 3.2, BLUE);
    text(ctx, 'PAP 21', 22, y + 37, { size: 2, weight: 700, color: BLUE });
    y += 46;
  } else {
    text(ctx, 'BATCH', 4, y, { size: 1.8, weight: 800, color: MUTED });
    text(ctx, 'L-0919-26', 4, y + 4, { size: 2.3, weight: 600 });
    y += 12;
  }
  if (onRight.includes('language')) {
    text(ctx, 'FR / EN', 4, y + 4, { size: 3.4, weight: 800 });
    lines(ctx, ['Peaux sensibles', 'Sensitive skin'], 4, y + 9, 3, { size: 1.9, font: 'Georgia, serif' });
    y += 18;
  }
  if (onRight.includes('claim')) {
    text(ctx, '24H HYDRATION', 4, y + 4, { size: 3, weight: 900, color: RED });
    y += 10;
  }
  // PAO jar symbol
  ctx.strokeStyle = INK;
  ctx.lineWidth = mm(0.3);
  ctx.strokeRect(mm(4), mm(108), mm(8), mm(7));
  ctx.beginPath();
  ctx.moveTo(mm(4), mm(110));
  ctx.lineTo(mm(12), mm(110));
  ctx.stroke();
  text(ctx, '12M', 8, 114, { size: 1.8, weight: 800, align: 'center' });
  if (over) hatch(ctx, 2.5, 12, 31, Math.min(90, y - 8));
  text(ctx, s.market === 'CANADA' ? 'CA' : 'EU', 32, 124, { size: 2, weight: 700, align: 'right' });
}

function drawBack(ctx, s) {
  const onBack = s.kindsOn.BACK;
  const over = s.overloaded.includes('BACK');
  tag(ctx, 'BACK', 5, 7.5, MUTED);
  text(ctx, 'INGREDIENTS', 5, 16, { size: 2.2, weight: 800, spacing: 0.2 });
  lines(ctx, [
    'Aqua, Glycerin, Caprylic/Capric',
    'Triglyceride, Squalane, Cetearyl',
    'Alcohol, Ceramide NP, Ceramide AP,',
    'Ceramide EOP, Phytosphingosine,',
    'Cholesterol, Sodium Lauroyl',
    'Lactylate, Carbomer, Xanthan Gum.',
  ], 5, 20, 3, { size: 2, font: 'Georgia, serif' });
  let y = 42;
  if (onBack.includes('language')) {
    rule(ctx, 5, y, 46);
    text(ctx, 'FR / EN — BILINGUAL COPY', 5, y + 5, { size: 2.2, weight: 800 });
    lines(ctx, [
      'Crème barrière aux céramides pour',
      'peaux sensibles. Ceramide barrier',
      'cream for sensitive skin. Appliquer',
      'matin et soir / Apply morning and',
      'evening. Usage externe / External use.',
    ], 5, y + 10, 3, { size: 1.9, font: 'Georgia, serif' });
    y += 28;
  }
  if (onBack.includes('data')) {
    qr(ctx, 5, y + 2, 16, s.seed + 11);
    text(ctx, 'SCAN · RECYCLE', 24, y + 9, { size: 1.8, weight: 800, color: BLUE });
    y += 22;
  }
  if (onBack.includes('claim')) {
    text(ctx, '24H HYDRATION', 5, y + 5, { size: 3.4, weight: 900, color: RED });
    y += 10;
  }
  const responsible = s.market === 'CANADA'
    ? ['Distributed by / Distribué par', 'NORD Labs Canada — Montréal QC']
    : ['Responsible person', 'NORD Labs EU — Lyon, France'];
  lines(ctx, responsible, 5, 104, 3, { size: 1.8, color: MUTED });
  barcode(ctx, 30, 111, 21, 9, s.seed + 17);
  if (over) hatch(ctx, 3.5, 10, 49, Math.min(92, y - 8));
}

function drawTop(ctx) {
  text(ctx, 'NORD', 28, 20, { size: 5, font: 'Georgia, serif', align: 'center' });
  text(ctx, 'LIFT TO OPEN ▸', 28, 27, { size: 1.8, weight: 800, align: 'center', color: MUTED, spacing: 0.2 });
}

const DRAWERS = { FRONT: drawFront, LEFT_COPY: drawLeft, RIGHT_DATA: drawRight, BACK: drawBack, TOP: drawTop };

export function createPanelTexture(surface) {
  const [wmm, hmm] = PANEL_MM[surface];
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(mm(wmm));
  canvas.height = Math.round(mm(hmm));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.userData.canvas = canvas;
  return texture;
}

export function paintPanel(texture, surface, state) {
  const canvas = texture.userData.canvas;
  const ctx = canvas.getContext('2d');
  const seed = hash(surface + state.market);
  paper(ctx, canvas.width, canvas.height, seed);
  DRAWERS[surface]?.(ctx, { ...state, seed });
  texture.needsUpdate = true;
}

// Requirement card faces (drawn, not DOM: they occlude and never desync).
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
