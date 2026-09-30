import React, { useMemo } from 'react';

// Editorial headline that lives in the front-panel column. Its width axis
// narrows with the front's load; when the front is over capacity the last
// words are physically pushed out past the face edge.
export function ColumnHeadline({ text, stretch, spill = 0, tone = 'ink' }) {
  const words = useMemo(() => text.split(' '), [text]);
  const start = words.length - spill;
  return (
    <h1 className={'column-headline tone-' + tone} style={{ fontStretch: stretch + '%' }} aria-label={text} key={text}>
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
