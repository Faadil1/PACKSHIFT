import React, { useLayoutEffect, useRef } from 'react';
import { REQUIREMENTS } from '../model/pressure.js';

// Each requirement is a character: a bold modular shape with an ink outline
// and eyes that follow the pointer. They live in the editorial layout and
// argue for space in handwritten margin notes.

export const CAST = {
  language: { shape: 'round', color: '#f3efe6', w: 64, h: 64 },
  data: { shape: 'square', color: '#00c2ff', w: 60, h: 60 },
  claim: { shape: 'tall', color: '#ff2e9a', w: 58, h: 92 },
  warning: { shape: 'tri', color: '#ffe14a', w: 74, h: 66 },
  eco: { shape: 'leaf', color: '#36e07e', w: 62, h: 62 },
  barcode: { shape: 'slab', color: '#b9b2a6', w: 50, h: 76 },
};

export const LOUD = {
  language: 'je veux la façade !',
  data: 'scannez-moi ICI',
  claim: 'moi d’abord.',
  warning: 'c’est obligatoire',
  eco: 'on me voit ?',
  barcode: 'je pousse…',
};

export const CALM = {
  FRONT: 'la façade, merci',
  LEFT_COPY: 'gauche, ok',
  RIGHT_DATA: 'droite ✓',
  BACK: 'le dos, parfait',
};

export function Character({
  kind, size = 1, note, noteTone = 'ink', state = '', selected, dragging, disabled, onPointerDown, onKeySelect, onRemove, index = 0, look, label, ariaLabel, removeLabel,
}) {
  const c = CAST[kind];
  const meta = REQUIREMENTS[kind];
  const name = label || meta.label;
  const w = Math.round(c.w * size);
  const h = Math.round(c.h * size);
  const lx = look ? Math.max(-2.5, Math.min(2.5, look[0])) : 0;
  const ly = look ? Math.max(-2.5, Math.min(2.5, look[1])) : 0;
  return (
    <div
      className={`char char-${c.shape} ${state}${selected ? ' selected' : ''}${dragging ? ' lifted' : ''}`}
      data-char={kind}
      style={{ '--i': index }}
    >
      {note && <span className={'margin-note tone-' + noteTone} key={note}>{note}</span>}
      <button
        className="char-body"
        style={{ width: w, height: h, background: c.color }}
        disabled={disabled}
        onPointerDown={onPointerDown}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKeySelect?.(); } }}
        aria-pressed={selected}
        aria-label={ariaLabel || `${name}. Glisse-le sur une face, ou appuie sur Entrée puis choisis une face.`}
      >
        <span className="eyes" aria-hidden="true">
          <i><b style={{ transform: `translate(${lx}px, ${ly}px)` }} /></i>
          <i><b style={{ transform: `translate(${lx}px, ${ly}px)` }} /></i>
        </span>
      </button>
      <span className="char-label">{name}</span>
      {onRemove && !disabled && (
        <button className="char-x" onClick={onRemove} aria-label={removeLabel || `Retirer ${name}`}>×</button>
      )}
    </div>
  );
}

// FLIP: characters are rendered inside whichever container they belong to
// (column, a face slot, the wings). When they change container, animate from
// their previous screen position so they visibly walk across the spread.
export function useFlip(rootRef, key) {
  const last = useRef(new Map());
  // Runs only when the arrangement changes (not on every render), and measures
  // layout before starting new animations, so re-renders mid-flight (drag
  // updates, notes) can never pin a character at a stale position.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const next = new Map();
    root.querySelectorAll('[data-char]').forEach((el) => {
      const id = el.getAttribute('data-char');
      el.getAnimations().forEach((a) => { if (a.id === 'flip') a.cancel(); });
      const rect = el.getBoundingClientRect();
      next.set(id, rect);
      const prev = last.current.get(id);
      if (!prev || reduced) return;
      const dx = prev.left - rect.left;
      const dy = prev.top - rect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 46}px)`, offset: 0.5 },
          { transform: 'translate(0, 0)' },
        ],
        { id: 'flip', duration: 820, easing: 'cubic-bezier(.34,1.2,.64,1)', delay: (Number(el.style.getPropertyValue('--i')) || 0) * 60 },
      );
    });
    last.current = next;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
