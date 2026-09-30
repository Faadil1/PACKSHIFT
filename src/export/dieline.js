// Concept dieline export (SVG, millimetres).
//
// Cut lines (solid), crease lines (dashed), 3 mm bleed and 4 mm safe area,
// every panel labelled with the requirements placed on it and its load.
// Layout matches the runtime's flat pose: glue | back | right | front | left,
// top + tuck above the front, bottom below, dust flaps on the side panels.
//
// CONCEPT ONLY: not a production-ready or certified dieline.

import { REQUIREMENTS, SURFACE_LABEL, clampDims } from '../model/pressure.js';

const GLUE = 12;
const DUST = 16;
const TUCK = 15;
const BLEED = 3;
const SAFE = 4;
const T = 0.45;

function rects(dims) {
  const { width: W, depth: D, height: H } = clampDims(dims);
  const y0 = TUCK + D;
  const xBack = GLUE;
  const xRight = GLUE + W;
  const xFront = GLUE + W + D;
  const xLeft = GLUE + 2 * W + D;
  const dustW = D - 2 * T;
  return [
    { id: 'GLUE_FLAP', x: 0, y: y0 + 2 * T, w: GLUE, h: H - 4 * T, print: false },
    { id: 'BACK', x: xBack, y: y0, w: W, h: H, print: true },
    { id: 'RIGHT_DATA', x: xRight, y: y0, w: D, h: H, print: true },
    { id: 'FRONT', x: xFront, y: y0, w: W, h: H, print: true },
    { id: 'LEFT_COPY', x: xLeft, y: y0, w: D, h: H, print: true },
    { id: 'TOP', x: xFront, y: TUCK, w: W, h: D, print: true },
    { id: 'TOP_TUCK', x: xFront + 3 * T, y: 0, w: W - 6 * T, h: TUCK, print: false },
    { id: 'BOTTOM', x: xFront, y: y0 + H, w: W, h: D, print: false },
    { id: 'TOP_DUST_RIGHT', x: xRight + T, y: y0 - DUST, w: dustW, h: DUST, print: false },
    { id: 'BOTTOM_DUST_RIGHT', x: xRight + T, y: y0 + H, w: dustW, h: DUST, print: false },
    { id: 'TOP_DUST_LEFT', x: xLeft + T, y: y0 - DUST, w: dustW, h: DUST, print: false },
    { id: 'BOTTOM_DUST_LEFT', x: xLeft + T, y: y0 + H, w: dustW, h: DUST, print: false },
  ];
}

function edges(r) {
  return [
    { o: 'h', c: r.y, a: r.x, b: r.x + r.w },
    { o: 'h', c: r.y + r.h, a: r.x, b: r.x + r.w },
    { o: 'v', c: r.x, a: r.y, b: r.y + r.h },
    { o: 'v', c: r.x + r.w, a: r.y, b: r.y + r.h },
  ];
}

// Split every rectangle edge into the part shared with a neighbour (crease)
// and the free part (cut).
export function dielineSegments(dims) {
  const list = rects(dims);
  const cuts = [];
  const creases = [];
  const eps = 0.01;
  list.forEach((r, i) => {
    edges(r).forEach((e) => {
      const shared = [];
      list.forEach((other, j) => {
        if (i === j) return;
        edges(other).forEach((f) => {
          if (f.o !== e.o || Math.abs(f.c - e.c) > eps) return;
          const a = Math.max(e.a, f.a);
          const b = Math.min(e.b, f.b);
          if (b - a > eps) {
            shared.push([a, b]);
            if (i < j) creases.push({ o: e.o, c: e.c, a, b });
          }
        });
      });
      shared.sort((p, q) => p[0] - q[0]);
      let cursor = e.a;
      for (const [a, b] of shared) {
        if (a - cursor > eps) cuts.push({ o: e.o, c: e.c, a: cursor, b: a });
        cursor = Math.max(cursor, b);
      }
      if (e.b - cursor > eps) cuts.push({ o: e.o, c: e.c, a: cursor, b: e.b });
    });
  });
  return { rects: list, cuts, creases };
}

const line = (s, cls) => (s.o === 'h'
  ? `<line class="${cls}" x1="${s.a.toFixed(2)}" y1="${s.c.toFixed(2)}" x2="${s.b.toFixed(2)}" y2="${s.c.toFixed(2)}"/>`
  : `<line class="${cls}" x1="${s.c.toFixed(2)}" y1="${s.a.toFixed(2)}" x2="${s.c.toFixed(2)}" y2="${s.b.toFixed(2)}"/>`);

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function dielineSVG({ dims, market, placements, pressures, valid }) {
  const d = clampDims(dims);
  const { rects: list, cuts, creases } = dielineSegments(d);
  const width = GLUE + 2 * d.width + 2 * d.depth;
  const height = TUCK + 2 * d.depth + d.height + DUST;
  const pad = 14;
  const titleH = 26;
  const vbW = width + pad * 2;
  const vbH = height + pad * 2 + titleH;

  const byId = Object.fromEntries(list.map((r) => [r.id, r]));
  const body = [byId.BACK, byId.RIGHT_DATA, byId.FRONT, byId.LEFT_COPY];
  const bx = body[0].x - BLEED;
  const by = body[0].y - BLEED;
  const bw = body[3].x + body[3].w - body[0].x + 2 * BLEED;
  const bh = body[0].h + 2 * BLEED;

  const kindsOn = {};
  Object.entries(placements).forEach(([kind, surface]) => {
    if (surface) (kindsOn[surface] ||= []).push(kind);
  });

  const labels = list.map((r) => {
    const cx = r.x + r.w / 2;
    if (!r.print) {
      const cy = r.y + r.h / 2;
      const rotate = r.w < 16 ? ` transform="rotate(-90 ${cx.toFixed(2)} ${cy.toFixed(2)})"` : '';
      return `<text class="small" x="${cx.toFixed(2)}" y="${(cy + 0.8).toFixed(2)}" text-anchor="middle"${rotate}>${esc(r.id.replace(/_/g, ' '))}</text>`;
    }
    const name = SURFACE_LABEL[r.id] || r.id;
    const load = pressures?.[r.id] !== undefined ? `${Math.round(pressures[r.id] * 100)}% load` : '';
    const reqs = (kindsOn[r.id] || []).map((k, i) => `<text class="req" x="${(r.x + SAFE + 1).toFixed(2)}" y="${(r.y + 22 + i * 5).toFixed(2)}" style="fill:${REQUIREMENTS[k].color}">${esc(REQUIREMENTS[k].label)}</text>`).join('');
    const over = pressures?.[r.id] > 1;
    return `<rect class="safe" x="${(r.x + SAFE).toFixed(2)}" y="${(r.y + SAFE).toFixed(2)}" width="${(r.w - 2 * SAFE).toFixed(2)}" height="${(r.h - 2 * SAFE).toFixed(2)}"/>`
      + `<text class="panel${over ? ' over' : ''}" x="${(r.x + SAFE + 1).toFixed(2)}" y="${(r.y + SAFE + 5).toFixed(2)}">${esc(name.toUpperCase())}</text>`
      + (load ? `<text class="small${over ? ' over' : ''}" x="${(r.x + SAFE + 1).toFixed(2)}" y="${(r.y + SAFE + 10).toFixed(2)}">${load}</text>` : '')
      + reqs;
  }).join('');

  const status = valid ? 'VALID FORM (demo rules)' : 'NOT RESOLVED';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${vbW}mm" height="${vbH}mm" viewBox="0 0 ${vbW} ${vbH}">
  <title>PACKSHIFT concept dieline — ${d.width} x ${d.depth} x ${d.height} mm — ${esc(market)}</title>
  <style>
    .paper{fill:#fbf8f2}
    .cut{stroke:#d0021b;stroke-width:.35;fill:none}
    .crease{stroke:#2f5fd0;stroke-width:.3;stroke-dasharray:2 1.2;fill:none}
    .bleed{stroke:#c2188a;stroke-width:.2;stroke-dasharray:.6 .8;fill:none}
    .safe{stroke:#3f6b3b;stroke-width:.18;stroke-dasharray:.5 .7;fill:none}
    text{font-family:Inter,Arial,sans-serif;fill:#181611}
    .panel{font-size:3.2px;font-weight:800;letter-spacing:.2px}
    .small{font-size:2.3px;fill:#6b6459}
    .req{font-size:2.8px;font-weight:800}
    .over{fill:#b73e33}
    .title{font-size:5px;font-weight:800}
    .note{font-size:2.4px;fill:#6b6459}
  </style>
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text class="title" x="${pad}" y="${pad}">PACKSHIFT — concept dieline</text>
  <text class="note" x="${pad}" y="${pad + 5}">${d.width} × ${d.depth} × ${d.height} mm · market ${esc(market)} · ${status} · board 0.45 mm · glue ${GLUE} · dust ${DUST} · tuck ${TUCK} · bleed ${BLEED} · safe ${SAFE}</text>
  <text class="note" x="${pad}" y="${pad + 9}">Legend: red solid = cut · blue dashed = crease · magenta = bleed · green = safe area. CONCEPT ONLY — not a production or certified dieline; capacities are demo logic.</text>
  <g transform="translate(${pad} ${pad + titleH})">
    ${list.map((r) => `<rect class="paper" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`).join('')}
    <rect class="bleed" x="${bx}" y="${by}" width="${bw}" height="${bh}"/>
    ${labels}
    ${creases.map((s) => line(s, 'crease')).join('')}
    ${cuts.map((s) => line(s, 'cut')).join('')}
  </g>
</svg>
`;
}
