// Shareable result: a 1080×1350 portrait card (fits Instagram / WhatsApp /
// X previews) plus a spoiler-free text grid à la Wordle.

import { FACE_ORDER } from './levels.js';

const W = 1080;
const H = 1350;
const PAPER = '#f3efe6';
const INK = '#16140f';
const PEN = '#d7263d';
const MUTED = '#6f685c';

const DISPLAY = '"Archivo Variable", Archivo, "Arial Black", sans-serif';
const HAND = 'Caveat, "Comic Sans MS", cursive';
const MONO = '"JetBrains Mono Variable", "JetBrains Mono", monospace';

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load(`900 100px ${DISPLAY}`),
      document.fonts.load(`700 60px ${HAND}`),
      document.fonts.load(`500 30px ${MONO}`),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

function fitText(ctx, value, maxWidth, size, weight, family) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(value).width > maxWidth && s > 18) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

function drawSnapshot(ctx, source, x, y, w, h, contain = false) {
  if (!source || !source.width) return;
  const scale = contain ? Math.min(w / source.width, h / source.height) * 1.12 : Math.max(w / source.width, h / source.height) * 1.22;
  const dw = source.width * scale;
  const dh = source.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(source, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

/**
 * @param {object} p
 * @param {HTMLCanvasElement|null} p.snapshot  the WebGL canvas
 * @param {string} p.kicker   small line on top, e.g. "Niveau 3 · Tout le monde veut être vu"
 * @param {string} p.verdict  handwritten result, e.g. "Rangé en 7 coups"
 * @param {string} p.detail   e.g. "6 mentions obligatoires · boîte de 5,6 cm · 0:42"
 * @param {number} p.stars    0–3
 * @param {object} p.pressures  face -> load (1 = full)
 * @param {boolean} p.fits
 * @param {string} p.host     e.g. "packshift-awd.pages.dev"
 * @param {string[]} p.titleLines  e.g. ['EST-CE QUE', 'ÇA RENTRE ?']
 * @param {object} p.faces   face -> localised name
 * @param {string} p.cta     e.g. 'À toi de jouer →'
 */
export async function renderShareCard(p) {
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const GALLERY = '#1c1a16';
  const FLOOR = '#2a2620';
  const GOLD = '#d9b25f';

  // the gallery: wall, floor, a spotlight cone
  ctx.fillStyle = GALLERY;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = FLOOR;
  ctx.fillRect(0, 880, W, H - 880);
  const glow = ctx.createRadialGradient(W / 2, 380, 40, W / 2, 380, 520);
  glow.addColorStop(0, 'rgba(255,236,196,.22)');
  glow.addColorStop(1, 'rgba(255,236,196,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 880);
  ctx.fillStyle = 'rgba(255,244,220,.07)';
  ctx.beginPath();
  ctx.moveTo(W * 0.43, 0);
  ctx.lineTo(W * 0.57, 0);
  ctx.lineTo(W * 0.84, 880);
  ctx.lineTo(W * 0.16, 880);
  ctx.closePath();
  ctx.fill();

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#b9ad94';
  ctx.font = `500 22px ${MONO}`;
  ctx.fillText((p.cartel?.house || p.kicker).toUpperCase(), 72, 78);

  // the question, in paper white
  const size = Math.min(
    118,
    fitText(ctx, p.titleLines[0], W - 144, 200, '900 extra-condensed', DISPLAY),
    fitText(ctx, p.titleLines[1], W - 144, 200, '900 extra-condensed', DISPLAY),
  );
  ctx.font = `900 extra-condensed ${size}px ${DISPLAY}`;
  ctx.fillStyle = PAPER;
  ctx.fillText(p.titleLines[0], 68, 96 + size * 0.95);
  ctx.fillStyle = p.fits ? PAPER : PEN;
  ctx.fillText(p.titleLines[1], 68, 96 + size * 1.85);

  // the work itself: the box on its pedestal (transparent 3D snapshot)
  drawSnapshot(ctx, p.snapshot, 90, 300, W - 180, 640, true);

  // handwritten verdict, gold, bottom left
  ctx.fillStyle = GOLD;
  fitText(ctx, p.verdict, 470, 70, 700, HAND);
  ctx.fillText(p.verdict, 72, 1010);
  ctx.fillStyle = '#cfc3a8';
  fitText(ctx, p.detail, 470, 26, 600, DISPLAY);
  const words = p.detail.split(' · ');
  words.forEach((w, i) => ctx.fillText(w, 74, 1060 + i * 34));

  // the gallery label (cartel), bottom right
  const cx = 580;
  const cy = 900;
  const cw = 430;
  const ch = 210;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(cx + 8, cy + 12, cw, ch);
  ctx.fillStyle = '#fbf8f1';
  ctx.fillRect(cx, cy, cw, ch);
  const c = p.cartel || {};
  ctx.fillStyle = INK;
  fitText(ctx, c.artist || '', cw - 60, 32, 800, DISPLAY);
  ctx.fillText(c.artist || '', cx + 28, cy + 50);
  ctx.font = `italic 400 24px Newsreader, Georgia, serif`;
  fitText(ctx, c.work || '', cw - 56, 24, 'italic 400', 'Newsreader, Georgia, serif');
  ctx.fillText(c.work || '', cx + 28, cy + 86);
  ctx.fillStyle = '#3d3932';
  (c.lines || []).slice(0, 2).forEach((line, i) => {
    fitText(ctx, line, cw - 56, 19, 400, 'Newsreader, Georgia, serif');
    ctx.fillText(line, cx + 28, cy + 118 + i * 26);
  });
  ctx.fillStyle = 'rgba(20,19,19,.18)';
  ctx.fillRect(cx + 28, cy + 160, cw - 56, 2);
  ctx.fillStyle = INK;
  ctx.font = `500 16px ${MONO}`;
  ctx.fillText(c.acquired || '', cx + 28, cy + 190);
  if (p.stars) {
    ctx.fillStyle = PEN;
    ctx.font = `900 22px ${DISPLAY}`;
    ctx.fillText('★'.repeat(p.stars), cx + 28 + ctx.measureText(c.acquired || '').width + 60, cy + 191);
  }
  if (p.fits) {
    ctx.fillStyle = PEN;
    ctx.beginPath();
    ctx.arc(cx + cw - 40, cy + 184, 13, 0, Math.PI * 2);
    ctx.fill();
  }

  // footer / call to action
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, H - 110, W, 110);
  ctx.fillStyle = INK;
  ctx.font = `900 40px ${DISPLAY}`;
  ctx.fillText(p.cta, 72, H - 44);
  ctx.textAlign = 'right';
  ctx.font = `500 28px ${MONO}`;
  ctx.fillText(p.host, W - 72, H - 46);
  ctx.textAlign = 'left';

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

// Spoiler-free text for group chats: how full each face is, not what is where.
export function shareText({ appTitle, faces, title, fits, stars, detail, pressures, url }) {
  const bar = (load) => {
    const n = Math.max(load > 0 ? 1 : 0, Math.min(5, Math.round(Math.min(1, load) * 5)));
    const fill = load > 1 ? '🟥' : '🟩';
    return Array.from({ length: 5 }, (_, i) => (i < n ? fill : '⬜')).join('');
  };
  const rows = FACE_ORDER.map((f) => `${bar(pressures?.[f] ?? 0)} ${faces[f]}`).join('\n');
  return [
    `📦 ${appTitle} — ${title}`,
    `${fits ? '✅' : '❌'} ${detail}${stars ? ' ' + '⭐'.repeat(stars) : ''}`,
    rows,
    url,
  ].join('\n');
}
