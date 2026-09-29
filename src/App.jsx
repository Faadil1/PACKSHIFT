import React, { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PackageScene } from './scene/PackageScene.jsx';

const SURFACES = ['FRONT', 'LEFT_COPY', 'RIGHT_DATA', 'BACK'];
const CAPACITY = {
  FRONT: 0.72,
  LEFT_COPY: 0.68,
  RIGHT_DATA: 0.64,
  BACK: 0.88,
};
const WEIGHT = {
  language: 0.46,
  data: 0.34,
  claim: 0.44,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildPressure(placements) {
  const loads = Object.fromEntries(SURFACES.map((surface) => [surface, 0]));
  Object.entries(placements).forEach(([kind, surface]) => {
    if (surface && loads[surface] !== undefined) loads[surface] += WEIGHT[kind] || 0;
  });
  return Object.fromEntries(
    SURFACES.map((surface) => [surface, loads[surface] / CAPACITY[surface]]),
  );
}

export default function App() {
  const [market, setMarket] = useState('EU');
  const [viewMode, setViewMode] = useState('PACK');
  const [decomposition, setDecomposition] = useState(0);
  const [placements, setPlacements] = useState({
    language: null,
    data: null,
    claim: null,
  });
  const [compiled, setCompiled] = useState(false);
  const [compilePhase, setCompilePhase] = useState('idle');
  const [running, setRunning] = useState(false);
  const animationToken = useRef(0);

  const pressures = useMemo(() => buildPressure(placements), [placements]);
  const collisionSurfaces = useMemo(
    () => SURFACES.filter((surface) => pressures[surface] > 1),
    [pressures],
  );
  const placedCount = Object.values(placements).filter(Boolean).length;
  const collision = collisionSurfaces.length > 0;

  const animateDecomposition = async (target, duration = 1200) => {
    const token = ++animationToken.current;
    const from = decomposition;
    const start = performance.now();

    await new Promise((resolve) => {
      const tick = (now) => {
        if (token !== animationToken.current) return resolve();
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setDecomposition(from + (target - from) * eased);
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  };

  const setMode = async (mode) => {
    if (running) return;
    setViewMode(mode);
    const presets = { PACK: 0, EXPLODED: 58, DIELINE: 100, XRAY: 34, PRESSURE: decomposition };
    if (mode !== 'PRESSURE') {
      animationToken.current += 1;
      setDecomposition(presets[mode]);
    }
  };

  const placeConstraint = (kind, surface) => {
    if (running) return;
    setCompiled(false);
    setCompilePhase('idle');
    setPlacements((current) => ({ ...current, [kind]: surface }));
  };

  const compileSurface = async () => {
    if (running || placedCount === 0) return;
    setRunning(true);
    setCompiled(false);
    setCompilePhase('opening');
    setViewMode('EXPLODED');
    await animateDecomposition(62, 1150);

    setCompilePhase('dieline');
    setViewMode('DIELINE');
    await animateDecomposition(100, 850);
    await sleep(350);

    setCompilePhase('reflow');
    setPlacements({
      language: market === 'CANADA' ? 'BACK' : 'LEFT_COPY',
      data: 'RIGHT_DATA',
      claim: 'FRONT',
    });
    await sleep(1150);

    setCompilePhase('closing');
    setViewMode('PACK');
    await animateDecomposition(0, 1300);

    setCompiled(true);
    setCompilePhase('valid');
    await sleep(650);
    setCompilePhase('idle');
    setRunning(false);
  };

  const runSignatureDemo = async () => {
    if (running) return;
    setRunning(true);
    setCompiled(false);
    setViewMode('PACK');
    setDecomposition(0);
    setMarket('EU');
    setCompilePhase('idle');
    setPlacements({ language: null, data: null, claim: null });
    await sleep(650);

    setPlacements({ language: 'FRONT', data: null, claim: null });
    await sleep(850);
    setPlacements({ language: 'FRONT', data: 'FRONT', claim: null });
    await sleep(850);
    setPlacements({ language: 'FRONT', data: 'FRONT', claim: 'FRONT' });
    setCompilePhase('collision');
    await sleep(1350);

    setCompilePhase('opening');
    setViewMode('EXPLODED');
    await animateDecomposition(62, 1200);

    setCompilePhase('dieline');
    setViewMode('DIELINE');
    await animateDecomposition(100, 850);
    await sleep(450);

    setCompilePhase('reflow');
    setPlacements({ language: 'LEFT_COPY', data: 'RIGHT_DATA', claim: 'FRONT' });
    await sleep(1200);

    setCompilePhase('closing');
    setViewMode('PACK');
    await animateDecomposition(0, 1300);

    setCompiled(true);
    setCompilePhase('valid');
    await sleep(950);

    setMarket('CANADA');
    setCompiled(false);
    setPlacements({ language: 'BACK', data: 'RIGHT_DATA', claim: 'FRONT' });
    setCompilePhase('market');
    setViewMode('EXPLODED');
    await animateDecomposition(45, 750);
    await animateDecomposition(0, 900);
    setViewMode('PACK');
    setCompiled(true);
    setCompilePhase('idle');
    setRunning(false);
  };

  const resetStudio = () => {
    if (running) return;
    animationToken.current += 1;
    setPlacements({ language: null, data: null, claim: null });
    setDecomposition(0);
    setViewMode('PACK');
    setCompiled(false);
    setCompilePhase('idle');
  };

  const sceneCopy = (() => {
    if (compilePhase === 'collision' || collision) {
      return ['IMPOSSIBLE FRONT', 'The surface is refusing the brief.'];
    }
    if (compilePhase === 'reflow') {
      return ['SPATIAL REFLOW', 'The package negotiates where every requirement belongs.'];
    }
    if (compilePhase === 'opening' || viewMode === 'EXPLODED') {
      return ['OPEN THE OBJECT', 'Structure, product and information separate into one system.'];
    }
    if (viewMode === 'DIELINE') {
      return ['DIELINE FIELD', 'Every printable surface is now part of the conversation.'];
    }
    if (viewMode === 'XRAY') {
      return ['X-RAY', 'The package is more than its skin.'];
    }
    if (viewMode === 'PRESSURE') {
      return ['PRESSURE MAP', 'Surface demand becomes visible before it becomes a problem.'];
    }
    if (compiled) {
      return ['VALID FORM', 'The same master closes with a new hierarchy.'];
    }
    return ['SPATIAL NEGOTIATION STUDIO', 'Drag requirements onto the pack. Open it. Break it. Recompile it.'];
  })();

  return (
    <main className={'shell mode-' + viewMode.toLowerCase()}>
      <header className="topbar">
        <div className="identity">
          <span>DAY 19 / V5</span>
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
                  if (running) return;
                  setMarket(value);
                  setCompiled(false);
                }}
              >
                {value}
              </button>
            ))}
          </div>
          <button className="run-demo" onClick={runSignatureDemo} disabled={running}>
            {running ? 'COMPILING…' : 'RUN SIGNATURE DEMO'}
          </button>
        </div>
      </header>

      <section className={'hero ' + (collision ? 'has-collision' : '')}>
        <div className="scene-copy">
          <span className="eyebrow">{sceneCopy[0]}</span>
          <h1>{sceneCopy[1]}</h1>
          <p>
            {placedCount === 0
              ? 'Drag one of the three requirements in 3D and release it over a package face.'
              : collision
                ? 'You can move a requirement yourself—or let PACKSHIFT compile the surface.'
                : 'Orbit freely. Scrub the object apart. Inspect the physical and informational system.'}
          </p>
        </div>

        <div className="canvas-wrap">
          <Canvas
            shadows
            dpr={[1, 1.75]}
            camera={{ position: [4.6, 2.6, 7.3], fov: 34 }}
            gl={{ antialias: true, alpha: true }}
          >
            <Suspense fallback={null}>
              <PackageScene
                market={market}
                viewMode={viewMode}
                decomposition={decomposition / 100}
                placements={placements}
                pressures={pressures}
                collisionSurfaces={collisionSurfaces}
                compiled={compiled}
                compilePhase={compilePhase}
                interactionLocked={running}
                onPlaceConstraint={placeConstraint}
              />
            </Suspense>
          </Canvas>
        </div>

        <aside className="view-rail" aria-label="View modes">
          {[
            ['PACK', '01'],
            ['EXPLODED', '02'],
            ['DIELINE', '03'],
            ['XRAY', '04'],
            ['PRESSURE', '05'],
          ].map(([mode, index]) => (
            <button
              key={mode}
              className={viewMode === mode ? 'active' : ''}
              onClick={() => setMode(mode)}
              disabled={running}
            >
              <span>{index}</span>{mode}
            </button>
          ))}
        </aside>

        <div className="runtime-truth">
          <span className={'runtime-dot ' + (collision ? 'collision' : compiled ? 'valid' : '')}></span>
          <div>
            <b>
              {collision
                ? 'OVER CAPACITY'
                : compiled
                  ? 'COMPILED / ' + market
                  : placedCount === 0
                    ? 'AWAITING INPUT'
                    : 'SURFACE LIVE'}
            </b>
            <small>
              {collision
                ? collisionSurfaces.join(' + ')
                : placedCount + '/3 requirements placed'}
            </small>
          </div>
        </div>
      </section>

      <section className="studio-console">
        <div className="decompose-control">
          <div className="control-heading">
            <span>DECOMPOSE OBJECT</span>
            <strong>{Math.round(decomposition)}%</strong>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={decomposition}
            disabled={running}
            onChange={(event) => {
              animationToken.current += 1;
              setDecomposition(Number(event.target.value));
              setViewMode('CUSTOM');
            }}
            aria-label="Package decomposition"
          />
          <div className="range-labels">
            <span>CLOSED</span>
            <span>INTERNALS</span>
            <span>SHELL</span>
            <span>DIELINE</span>
          </div>
        </div>

        <div className="pressure-strip">
          {SURFACES.map((surface) => {
            const ratio = pressures[surface] || 0;
            return (
              <div key={surface} className={'pressure-cell ' + (ratio > 1 ? 'over' : '')}>
                <span>{surface.replace('_', ' ')}</span>
                <i><b style={{ width: Math.min(100, ratio * 100) + '%' }}></b></i>
                <small>{Math.round(ratio * 100)}%</small>
              </div>
            );
          })}
        </div>

        <div className="compile-actions">
          <button className="reset" onClick={resetStudio} disabled={running}>RESET</button>
          <button
            className="compile"
            onClick={compileSurface}
            disabled={running || placedCount === 0}
          >
            <span>COMPILE SURFACE</span>
            <small>OPEN → REFLOW → REFOLD</small>
          </button>
        </div>
      </section>

      <footer>
        <span>DRAG REQUIREMENTS IN 3D · ORBIT TO INSPECT · SCRUB TO DECOMPOSE</span>
        <span>CONCEPT PROTOTYPE / NOT REGULATORY OR MANUFACTURING VALIDATION</span>
      </footer>
    </main>
  );
}
