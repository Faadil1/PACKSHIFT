import React from 'react';
import { CAST } from '../ui/Character.jsx';
import { LANGS, STRINGS } from './i18n.js';

// The front panel at (roughly) real size: 56 × 130 mm drawn in CSS millimetres
// (96 dpi) times a per-device factor `k`. Everything mandatory is printed on
// it in small type; "fill" adds every mention in every language, and the text
// runs off the bottom of the box.
export const FACE_PX = { w: 212, h: 491 }; // 56 × 130 mm at 96 dpi
const TEXT_TOP = 150;

// Best guess of the physical size of a CSS pixel. Desktops follow 96 dpi;
// phones and tablets draw CSS pixels smaller, so the face is scaled up.
export function guessScale() {
  if (typeof window === 'undefined') return 1;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const w = Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight);
  if (!coarse) return 1;
  const mmPerPx = w < 600 ? 68 / w : 0.22; // a phone is ~68 mm wide
  return Math.min(1.8, Math.max(0.8, (56 / mmPerPx) / FACE_PX.w));
}

export function RealSizeFace({ T, lang, filled, k, onPlay }) {
  const own = T.real.mentions;
  const others = LANGS.filter((l) => l !== lang).flatMap((l) => STRINGS[l].real.mentions.slice(0, 5));
  const lines = filled ? own.concat(others) : own.slice(0, 2);
  return (
    <div className={'rs-wrap' + (filled ? ' filled' : '')} style={{ width: FACE_PX.w * k, height: FACE_PX.h * k, '--k': k }}>
      <div className={'rs-face' + (filled ? ' filled' : '')} style={{ transform: `scale(${k})` }}>
        <i className="rs-crop tl" /><i className="rs-crop br" />
        <span className="rs-brand">NORD</span>
        <span className="rs-name">HYDRA<br />VEIL</span>
        <div className="rs-mini">
          <b>{T.appTitle}</b>
          <span className="rs-cast" aria-hidden="true">
            {Object.keys(CAST).map((kind) => (
              <span key={kind} className={`rs-char char-${CAST[kind].shape}`} style={{ background: CAST[kind].color }}><i /><i /></span>
            ))}
          </span>
          <button type="button" onClick={onPlay}>{T.play}</button>
        </div>
        <div className="rs-text" style={{ '--edge': `${FACE_PX.h - TEXT_TOP - 20}px` }}>
          {lines.map((line, i) => <p key={`${lang}-${i}`} style={{ '--i': i }}>{line}</p>)}
        </div>
        <span className="rs-qty">50 mL ℮</span>
        {filled && <span className="rs-edge" aria-hidden="true" />}
      </div>
    </div>
  );
}

export function Ruler({ k }) {
  const ticks = Array.from({ length: 57 }, (_, mm) => mm);
  return (
    <div className="rs-ruler" style={{ width: FACE_PX.w * k }} aria-hidden="true">
      {ticks.map((mm) => (
        <i key={mm} style={{ left: `${(mm / 56) * 100}%`, height: mm % 10 === 0 ? 12 : mm % 5 === 0 ? 8 : 4 }} />
      ))}
      <span>56 mm</span>
    </div>
  );
}
