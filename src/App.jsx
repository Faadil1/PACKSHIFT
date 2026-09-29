import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PackageScene } from './scene/PackageScene.jsx';

export default function App() {
  const [phase, setPhase] = useState('folded');
  const [market, setMarket] = useState('EU');

  const runCompile = () => {
    if (phase === 'unfolding' || phase === 'refolding') return;
    setPhase('unfolding');
  };

  const runRefold = () => {
    if (phase !== 'flat') return;
    setPhase('refolding');
  };

  const status = phase === 'folded'
    ? 'VALID FORM / ' + market
    : phase === 'flat'
      ? 'DIELINE OPEN'
      : phase === 'unfolding'
        ? 'UNFOLDING'
        : 'REFOLDING';

  return (
    <main className="shell">
      <header className="topbar">
        <div className="identity">
          <span>DAY 19 / V3 SPATIAL PROOF</span>
          <strong>PACKSHIFT</strong>
        </div>

        <p className="thesis">
          Packaging is not a file.<br />
          <em>It is a compiled surface.</em>
        </p>

        <div className="actions">
          <div className="market" role="group" aria-label="Market">
            {['EU', 'CANADA'].map((value) => (
              <button
                key={value}
                className={market === value ? 'active' : ''}
                onClick={() => setMarket(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="scene-copy">
          <span className="eyebrow">
            {phase === 'folded' && 'ONE MASTER'}
            {phase === 'unfolding' && 'OPENING DIELINE'}
            {phase === 'flat' && 'THE PACKAGE BECOMES THE SURFACE'}
            {phase === 'refolding' && 'REFOLDING'}
          </span>
          <h1>
            {phase === 'flat'
              ? 'Every face becomes available.'
              : 'The package is the interface.'}
          </h1>
          <p>
            {phase === 'flat'
              ? 'This is the geometry where language, claims and product data can negotiate real space.'
              : 'Compile should physically expose the surfaces being negotiated.'}
          </p>
        </div>

        <div className="canvas-wrap">
          <Canvas
            shadows
            dpr={[1, 1.8]}
            camera={{ position: [5.6, 3.2, 7.4], fov: 34 }}
            gl={{ antialias: true, alpha: true }}
          >
            <PackageScene
              phase={phase}
              market={market}
              onFlat={() => setPhase('flat')}
              onFolded={() => setPhase('folded')}
            />
          </Canvas>
        </div>

        <div className="status">
          <span className={'dot ' + phase}></span>
          <div>
            <b>{status}</b>
            <small>
              {phase === 'flat'
                ? 'Front, side, back, top and bottom are one editable field.'
                : 'One master object. Spatial state is live.'}
            </small>
          </div>
        </div>
      </section>

      <nav className="control-deck">
        <div className="sequence">
          <span>FOLDED</span><i>→</i><span>DIELINE</span><i>→</i><span>REFLOW</span><i>→</i><span>REFOLD</span>
        </div>

        {phase === 'flat' ? (
          <button className="primary" onClick={runRefold}>
            <span>REFOLD PACKAGE</span>
            <small>RETURN TO VALID FORM</small>
          </button>
        ) : (
          <button
            className="primary"
            onClick={runCompile}
            disabled={phase === 'unfolding' || phase === 'refolding'}
          >
            <span>COMPILE SURFACE</span>
            <small>OPEN THE DIELINE</small>
          </button>
        )}
      </nav>

      <footer>
        <span>THREE.JS / R3F / GSAP PROOF</span>
        <span>CONCEPT PROTOTYPE — NOT REGULATORY VALIDATION</span>
      </footer>
    </main>
  );
}
