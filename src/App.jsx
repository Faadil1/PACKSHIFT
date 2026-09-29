import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PackageScene } from './scene/PackageScene.jsx';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function App() {
  const [market, setMarket] = useState('EU');
  const [language, setLanguage] = useState(false);
  const [data, setData] = useState(false);
  const [claim, setClaim] = useState(false);
  const [stage, setStage] = useState('folded');
  const [compiled, setCompiled] = useState(false);
  const [running, setRunning] = useState(false);

  const busy = stage === 'opening' || stage === 'closing';
  const collision = language && data && claim && !compiled && stage === 'folded';
  const activeCount = [language, data, claim].filter(Boolean).length;

  const sceneCopy = useMemo(() => {
    if (stage === 'opening') return ['OPENING DIELINE', 'The package reveals its real geometry.'];
    if (stage === 'flat') return ['SURFACE EXPOSED', 'Every face becomes one negotiable field.'];
    if (stage === 'closing') return ['REFOLDING', 'The same master returns to volume.'];
    if (stage === 'valid') return ['VALID FORM', 'The surface is calm again.'];
    if (collision) return ['COLLISION', 'Two requirements want the same front-panel territory.'];
    if (claim) return ['CLAIM ENTERS', 'The front face is now under pressure.'];
    if (data) return ['DATA CLAIMS A FACE', 'The QR needs real package surface.'];
    if (language) return ['LANGUAGE ENTERS', 'Bilingual copy takes width.'];
    return ['ONE MASTER', 'The package is the interface.'];
  }, [stage, collision, claim, data, language]);

  const status = stage === 'valid'
    ? 'VALID FORM / ' + market
    : stage === 'opening'
      ? 'UNFOLDING'
      : stage === 'flat'
        ? 'DIELINE OPEN'
        : stage === 'closing'
          ? 'REFOLDING'
          : collision
            ? 'COLLISION'
            : 'SURFACE STABLE';

  const resetCompiled = () => {
    if (compiled || stage === 'valid') {
      setCompiled(false);
      setStage('folded');
    }
  };

  const toggleConstraint = (setter, value) => {
    if (busy || running) return;
    resetCompiled();
    setter(!value);
  };

  const compileSurface = async () => {
    if (busy || running || activeCount === 0) return;
    setCompiled(false);
    setStage('opening');
    await sleep(1450);
    setStage('flat');
    await sleep(1050);
    setStage('closing');
    await sleep(1450);
    setStage('valid');
    setCompiled(true);
  };

  const runDemo = async () => {
    if (running || busy) return;
    setRunning(true);
    setCompiled(false);
    setStage('folded');
    setMarket('EU');
    setLanguage(false);
    setData(false);
    setClaim(false);
    await sleep(900);
    setLanguage(true);
    await sleep(1200);
    setData(true);
    await sleep(1200);
    setClaim(true);
    await sleep(1500);
    setStage('opening');
    await sleep(1450);
    setStage('flat');
    await sleep(1050);
    setStage('closing');
    await sleep(1450);
    setStage('valid');
    setCompiled(true);
    await sleep(1200);
    setMarket('CANADA');
    setCompiled(false);
    setStage('folded');
    await sleep(850);
    setStage('opening');
    await sleep(1450);
    setStage('flat');
    await sleep(900);
    setStage('closing');
    await sleep(1450);
    setStage('valid');
    setCompiled(true);
    setRunning(false);
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="identity">
          <span>DAY 19 / SPATIAL COMPILER</span>
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
                onClick={() => {
                  if (busy || running) return;
                  setMarket(value);
                  setCompiled(false);
                  setStage('folded');
                }}
              >
                {value}
              </button>
            ))}
          </div>
          <button className="run-demo" onClick={runDemo} disabled={busy || running}>
            {running ? 'RUNNING…' : 'RUN 15S DEMO'}
          </button>
        </div>
      </header>

      <section className={'hero ' + (collision ? 'collision' : '')}>
        <div className="scene-copy">
          <span className="eyebrow">{sceneCopy[0]}</span>
          <h1>{sceneCopy[1]}</h1>
          <p>
            {stage === 'flat'
              ? 'Front, side, back, top and bottom are now exposed as one physical system.'
              : 'Requirements do not live in a checklist. They consume real surface.'}
          </p>
        </div>

        <div className="canvas-wrap">
          <Canvas
            shadows
            dpr={[1, 1.75]}
            camera={{ position: [4.8, 2.8, 7.6], fov: 33 }}
            gl={{ antialias: true, alpha: true }}
          >
            <PackageScene
              stage={stage}
              market={market}
              language={language}
              data={data}
              claim={claim}
              collision={collision}
              compiled={compiled}
            />
          </Canvas>
        </div>

        <div className="status">
          <span className={'dot ' + status.toLowerCase().replaceAll(' ', '-').replaceAll('/', '-')}></span>
          <div>
            <b>{status}</b>
            <small>
              {collision
                ? 'Surface pressure is unresolved.'
                : stage === 'flat'
                  ? 'Geometry exposed for reflow.'
                  : 'One source. One spatial master.'}
            </small>
          </div>
        </div>
      </section>

      <nav className="constraint-deck">
        <button
          className={'constraint ' + (language ? 'active' : '')}
          onClick={() => toggleConstraint(setLanguage, language)}
        >
          <span>01</span><div><b>FR / EN</b><small>LANGUAGE</small></div>
        </button>

        <button
          className={'constraint ' + (data ? 'active' : '')}
          onClick={() => toggleConstraint(setData, data)}
        >
          <span>02</span><div><b>DATA CARRIER</b><small>QR / RECYCLING</small></div>
        </button>

        <button
          className={'constraint ' + (claim ? 'active' : '')}
          onClick={() => toggleConstraint(setClaim, claim)}
        >
          <span>03</span><div><b>24H HYDRATION</b><small>CLAIM</small></div>
        </button>

        <button
          className="primary"
          onClick={compileSurface}
          disabled={busy || running || activeCount === 0}
        >
          <span>COMPILE SURFACE</span>
          <small>UNFOLD → REFLOW → REFOLD</small>
        </button>
      </nav>

      <footer>
        <span>THREE.JS / R3F / GSAP</span>
        <span>CONSTRAINT → COLLISION → DIELINE → REFLOW → VALID FORM</span>
        <span>CONCEPT PROTOTYPE</span>
      </footer>
    </main>
  );
}
