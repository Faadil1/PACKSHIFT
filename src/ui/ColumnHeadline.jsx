import React, { useLayoutEffect, useMemo, useRef } from 'react';

// Editorial headline that lives in the front-panel column. Its width axis
// narrows with the front's load; when the front is over capacity the last
// words are physically pushed out past the face edge.
export function ColumnHeadline({ text, stretch, spill = 0, tone = 'ink' }) {
  const words = useMemo(() => text.split(' '), [text]);
  const start = words.length - spill;
  const ref = useRef(null);
  // Long words (German/Spanish-length) must never cross the face edge: shrink
  // the type until the widest word fits the column, re-measuring after the
  // width-axis transition settles.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      el.style.setProperty('--fit', '1');
      // The limit is the dashed face edge drawn in the column, not the box.
      const edge = el.parentElement?.querySelector('.edge');
      const left = el.getBoundingClientRect().left;
      const room = edge ? edge.getBoundingClientRect().left - left - 10 : el.clientWidth;
      let widest = 0;
      el.querySelectorAll('.cw-in:not(.out)').forEach((w) => { widest = Math.max(widest, w.scrollWidth); });
      if (room > 0 && widest > room) el.style.setProperty('--fit', String(Math.max(0.5, (room / widest) * 0.97)));
    };
    fit();
    document.fonts?.ready.then(fit);
    el.addEventListener('transitionend', fit);
    window.addEventListener('resize', fit);
    return () => {
      el.removeEventListener('transitionend', fit);
      window.removeEventListener('resize', fit);
    };
  }, [text, stretch, spill]);
  return (
    <h1 className={'column-headline tone-' + tone} style={{ fontStretch: stretch + '%' }} aria-label={text} key={text} ref={ref}>
      {words.map((word, i) => {
        const out = i >= start;
        const k = i - start;
        return (
          <React.Fragment key={i}>
            <span className="cw" aria-hidden="true">
              <span
                className={'cw-in' + (out ? ' out' : '')}
                style={{ '--i': i, transform: out ? `translate(${0.9 + k * 0.5}em, ${0.25 + k * 0.35}em) rotate(${7 + k * 7}deg)` : undefined }}
              >
                {word}
              </span>
            </span>
          </React.Fragment>
        );
      })}
    </h1>
  );
}
