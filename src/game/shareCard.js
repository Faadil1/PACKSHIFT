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

function drawSnapshot(ctx, source, x, y, w, h) {
  if (!source || !source.width) return;
  const scale = Math.max(w / source.width, h / source.height) * 1.22;
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

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // paper grain
  for (let i = 0; i < 2600; i += 1) {
    ctx.fillStyle = `rgba(22,20,15,${Math.random() * 0.035})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = MUTED;
  ctx.font = `500 26px ${MONO}`;
  ctx.fillText(p.kicker.toUpperCase(), 72, 92);

  ctx.fillStyle = INK;
  // Same size for both lines, capped so short titles ("DOES IT / FIT?")
  // don't push the result off the card.
  const size = Math.min(
    170,
    fitText(ctx, p.titleLines[0], W - 144, 250, '900 extra-condensed', DISPLAY),
    fitText(ctx, p.titleLines[1], W - 144, 250, '900 extra-condensed', DISPLAY),
  );
  ctx.font = `900 extra-condensed ${size}px ${DISPLAY}`;
  const s1 = size;
  const s2 = size;
  ctx.fillText(p.titleLines[0], 68, 92 + s1 * 0.95);
  ctx.fillStyle = p.fits ? INK : PEN;
  ctx.fillText(p.titleLines[1], 68, 92 + s1 * 0.95 + s2 * 0.92);
  const top = 92 + s1 * 0.95 + s2 * 0.92 + 20;

  // the box
  const boxY = top + 10;
  const boxH = Math.max(420, 900 - top);
  drawSnapshot(ctx, p.snapshot, 72, boxY, W - 144, boxH);

  // handwritten verdict + stars, circled in pen
  const vY = boxY + boxH + 70;
  ctx.fillStyle = PEN;
  const vs = fitText(ctx, p.verdict, W - 360, 88, 700, HAND);
  ctx.fillText(p.verdict, 80, vY);
  const vw = ctx.measureText(p.verdict).width;
  ctx.strokeStyle = PEN;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(80 + vw / 2, vY - vs * 0.3, vw / 2 + 34, vs * 0.62, -0.03, 0.15, Math.PI * 2 + 0.05);
  ctx.stroke();
  if (p.stars) {
    ctx.font = `900 72px ${DISPLAY}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#d8d0c1';
    ctx.fillText('★★★', W - 72, vY);
    ctx.fillStyle = PEN;
    ctx.fillText('★'.repeat(p.stars), W - 72 - ctx.measureText('★'.repeat(3 - p.stars)).width, vY);
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = INK;
  fitText(ctx, p.detail, W - 144, 34, 700, DISPLAY);
  ctx.fillText(p.detail, 80, vY + 64);

  // four face gauges
  const gY = vY + 110;
  const gw = (W - 144 - 3 * 18) / 4;
  FACE_ORDER.forEach((face, i) => {
    const x = 72 + i * (gw + 18);
    const load = p.pressures?.[face] ?? 0;
    ctx.fillStyle = 'rgba(22,20,15,.08)';
    ctx.fillRect(x, gY, gw, 22);
    ctx.fillStyle = load > 1 ? PEN : INK;
    ctx.fillRect(x, gY, gw * Math.min(1, load), 22);
    if (load > 1) {
      ctx.fillStyle = PEN;
      ctx.fillRect(x + gw - 6, gY - 10, 6, 42);
    }
    ctx.fillStyle = MUTED;
    ctx.font = `500 22px ${MONO}`;
    fitText(ctx, `${p.faces[face].toUpperCase()} ${Math.round(load * 100)}%`, gw, 22, 500, MONO);
    ctx.fillText(`${p.faces[face].toUpperCase()} ${Math.round(load * 100)}%`, x, gY + 52);
  });

  // footer / call to action
  ctx.fillStyle = INK;
  ctx.fillRect(0, H - 110, W, 110);
  ctx.fillStyle = PAPER;
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
