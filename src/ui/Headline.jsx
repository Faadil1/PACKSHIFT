import React, { useMemo } from 'react';

// Headline with a staggered per-word reveal (masked rise) that re-plays when
// the text changes, and a CMY misregistration layer driven by `state`:
//   'misregistered' -> the three process plates drift apart (collision)
//   'registered'    -> plates snap back into register (valid form)
// Its width axis is bound to --wdth (surface load) by the parent.
export function Headline({ text, state = 'idle', as: Tag = 'h1', className = '' }) {
  const words = useMemo(() => text.split(' '), [text]);
  return (
    <Tag key={text} className={`headline ${state} ${className}`} aria-label={text}>
      {words.map((word, i) => (
        <React.Fragment key={i}>
          <span className="word" aria-hidden="true">
            <span className="word-inner" style={{ '--i': i }} data-text={word}>{word}</span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </React.Fragment>
      ))}
    </Tag>
  );
}

// Decorative prepress furniture: crop marks, registration targets and a
// colour control bar framing the stage.
export function PrepressMarks({ state }) {
  return (
    <div className={'prepress ' + state} aria-hidden="true">
      <i className="crop tl" /><i className="crop tr" /><i className="crop bl" /><i className="crop br" />
      <svg className="reg reg-l" viewBox="0 0 40 40"><circle cx="20" cy="20" r="11" /><circle cx="20" cy="20" r="5" /><path d="M20 2v36M2 20h36" /></svg>
      <svg className="reg reg-r" viewBox="0 0 40 40"><circle cx="20" cy="20" r="11" /><circle cx="20" cy="20" r="5" /><path d="M20 2v36M2 20h36" /></svg>
      <div className="colorbar">
        {['c', 'm', 'y', 'k', 'cm', 'my', 'cy', 't80', 't60', 't40', 't20', 't10'].map((c) => <i key={c} className={c} />)}
      </div>
    </div>
  );
}
