import React, { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { PackageScene } from './scene/PackageScene.jsx';
import {
  IMPOSSIBLE_FRONT,
  KINDS,
  MARKETS,
  REQUIREMENTS,
  SURFACES,
  SURFACE_LABEL,
  buildPressure,
  emptyPlacements,
  overloadedSurfaces,
  solvePlacements,
  surfaceLoads,
} from './model/pressure.js';

const VIEWS = [
  ['PACK', '01'],
  ['EXPLODED', '02'],
  ['DIELINE', '03'],
  ['XRAY', '04'],
  ['PRESSURE', '05'],
];
const VIEW_PRESET = { PACK: 0, EXPLODED: 44, DIELINE: 100, XRAY: 0, PRESSURE: 0 };

const reducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Pauses are reading time, so they are kept under reduced motion; only the
// animation itself is removed.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const forceProcedural = () => typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('procedural') === '1';

class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('PACKSHIFT: Blender master failed to load, using procedural fallback.', error);
    this.props.onFallback?.();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Loader() {
  const { active, progress } = useProgress();
  if (!active && progress >= 100) return null;
  return (
    <div className="loader" role="status" aria-live="polite">
      <span>Loading Blender master</span>
      <i><b style={{ width: Math.round(progress) + '%' }} /></i>
    </div>
  );
}

export default function App() {
  const [market, setMarket] = useState('EU');
  const [viewMode, setViewMode] = useState('PACK');
  const [decomposition, setDecomposition] = useState(0);
  const [placements, setPlacements] = useState(emptyPlacements);
  const [history, setHistory] = useState([]);
  const [compiled, setCompiled] = useState(false);
  const [compilePhase, setCompilePhase] = useState('idle');
  const [reflowMoves, setReflowMoves] = useState([]);
  const [running, setRunning] = useState(false);
  const [selectedKind, setSelectedKind] = useState(null);
  const [usingFallback, setUsingFallback] = useState(forceProcedural);
  const [announcement, setAnnouncement] = useState('');

  const animationToken = useRef(0);
  const decompositionRef = useRef(0);
  const runningRef = useRef(false);

  const setDecomp = useCallback((value) => {
    decompositionRef.current = value;
    setDecomposition(value);
  }, []);

  const pressures = useMemo(() => buildPressure(placements, market), [placements, market]);
  const loads = useMemo(() => surfaceLoads(placements, market), [placements, market]);
  const collisionSurfaces = useMemo(() => overloadedSurfaces(pressures), [pressures]);
  const placedCount = KINDS.filter((kind) => placements[kind]).length;
  const collision = collisionSurfaces.length > 0;

  // Always animates from the *live* value (ref), never from a stale render.
  const animateDecomposition = useCallback((target, duration = 1200) => {
    const token = ++animationToken.current;
    const from = decompositionRef.current;
    if (reducedMotion() || duration <= 0) {
      setDecomp(target);
      return Promise.resolve();
    }
    const start = performance.now();
    return new Promise((resolve) => {
      const tick = (now) => {
        if (token !== animationToken.current) return resolve();
        const t = Math.min(1, (now - start) / duration);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        setDecomp(from + (target - from) * eased);
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }, [setDecomp]);

  const lock = (value) => {
    runningRef.current = value;
    setRunning(value);
  };

  const commitPlacements = (next) => {
    setHistory((h) => [...h.slice(-19), placements]);
    setPlacements(next);
  };

  const setMode = (mode) => {
    if (runningRef.current) return;
    setViewMode(mode);
    animateDecomposition(VIEW_PRESET[mode] ?? decompositionRef.current, 700);
  };

  const placeConstraint = (kind, surface) => {
    if (runningRef.current) return;
    setSelectedKind(null);
    if (placements[kind] === surface) return;
    setCompiled(false);
    setCompilePhase('idle');
    commitPlacements({ ...placements, [kind]: surface });
    setAnnouncement(`${REQUIREMENTS[kind].label} placed on ${SURFACE_LABEL[surface]}.`);
  };

  const unplace = (kind) => {
    if (runningRef.current || !placements[kind]) return;
    commitPlacements({ ...placements, [kind]: null });
    setCompiled(false);
  };

  const undo = () => {
    if (runningRef.current || history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setPlacements(previous);
    setCompiled(false);
    setCompilePhase('idle');
    setAnnouncement('Undid last placement.');
  };

  const runCompile = async (from, targetMarket) => {
    const solution = solvePlacements(from, targetMarket);
    setCompiled(false);
    setSelectedKind(null);

    setCompilePhase('opening');
    setViewMode('EXPLODED');
    await animateDecomposition(46, 1250);

    setCompilePhase('dieline');
    setViewMode('DIELINE');
    await animateDecomposition(100, 1000);
    await sleep(300);

    setCompilePhase('reflow');
    setReflowMoves(solution.moves);
    setPlacements(solution.placements);
    await sleep(1500);

    setCompilePhase('closing');
    setViewMode('PACK');
    await animateDecomposition(0, 1500);

    setReflowMoves([]);
    setCompiled(solution.valid);
    setCompilePhase(solution.valid ? 'valid' : 'unsolved');
    setAnnouncement(solution.valid
      ? `Compiled. Valid form for ${MARKETS[targetMarket].label}. ${solution.moves.length} requirement(s) moved.`
      : 'No valid form exists for this brief.');
    return solution;
  };

  const compileSurface = async () => {
    if (runningRef.current) return;
    lock(true);
    setHistory((h) => [...h.slice(-19), placements]);
    await runCompile(placements, market);
    await sleep(700);
    setCompilePhase((phase) => (phase === 'valid' ? 'idle' : phase));
    lock(false);
  };

  const runSignatureDemo = async () => {
    if (runningRef.current) return;
    lock(true);
    animationToken.current += 1;
    setHistory((h) => [...h.slice(-19), placements]);
    setCompiled(false);
    setViewMode('PACK');
    setDecomp(0);
    setMarket('EU');
    setCompilePhase('idle');
    setSelectedKind(null);
    setPlacements(emptyPlacements());
    await sleep(700);

    setPlacements({ language: 'FRONT', data: null, claim: null });
    await sleep(850);
    setPlacements({ language: 'FRONT', data: 'FRONT', claim: null });
    await sleep(850);
    setPlacements(IMPOSSIBLE_FRONT);
    setCompilePhase('collision');
    setViewMode('PRESSURE');
    await sleep(1700);

    const eu = await runCompile(IMPOSSIBLE_FRONT, 'EU');
    await sleep(1100);

    // Same master, second market: the solver produces a different layout.
    setMarket('CANADA');
    setCompiled(false);
    setCompilePhase('market');
    await sleep(500);
    await runCompile(eu.placements, 'CANADA');
    await sleep(600);
    setCompilePhase('idle');
    lock(false);
  };

  const resetStudio = () => {
    if (runningRef.current) return;
    animationToken.current += 1;
    setHistory((h) => [...h.slice(-19), placements]);
    setPlacements(emptyPlacements());
    setDecomp(0);
    setViewMode('PACK');
    setCompiled(false);
    setCompilePhase('idle');
    setSelectedKind(null);
    setReflowMoves([]);
  };

  const changeMarket = (value) => {
    if (runningRef.current || value === market) return;
    setMarket(value);
    setCompiled(false);
    setCompilePhase('idle');
    setAnnouncement(`Market set to ${MARKETS[value].label}. Surface capacities updated.`);
  };

  // Keyboard: 1-5 views, C compile, R reset, Z undo, Esc deselect.
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.('input, select, textarea') || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key >= '1' && key <= '5') setMode(VIEWS[Number(key) - 1][0]);
      else if (key === 'c') compileSurface();
      else if (key === 'r') resetStudio();
      else if (key === 'z') undo();
      else if (key === 'escape') setSelectedKind(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sceneCopy = (() => {
    if (compilePhase === 'opening') return ['Open the object', 'Lid first. The product lifts out through the opening.'];
    if (compilePhase === 'dieline') return ['Dieline field', 'Every printable surface is now part of the conversation.'];
    if (compilePhase === 'reflow') return ['Spatial reflow', 'The package negotiates where every requirement belongs.'];
    if (compilePhase === 'closing') return ['Refold', 'The same master closes around a new hierarchy.'];
    if (compilePhase === 'market') return ['Same master, new market', 'Canada changes the capacities. Watch the layout recompile.'];
    if (compilePhase === 'unsolved') return ['No valid form', 'This brief cannot fit these surfaces. Remove a requirement.'];
    if (collision) {
      const which = collisionSurfaces.map((s) => SURFACE_LABEL[s].toLowerCase()).join(' + ');
      return [collisionSurfaces.includes('FRONT') ? 'Impossible front' : 'Over capacity', `The ${which} is refusing the brief.`];
    }
    if (compilePhase === 'opening' || viewMode === 'EXPLODED') return ['Open the object', 'Lid, product, insert and leaflet come apart as one system.'];
    if (viewMode === 'DIELINE') return ['Dieline field', 'Every printable surface is now part of the conversation.'];
    if (viewMode === 'XRAY') return ['X-ray', 'The package is more than its skin.'];
    if (viewMode === 'PRESSURE') return ['Pressure map', 'Surface demand becomes visible before it becomes a problem.'];
    if (compiled) return ['Valid form', 'The same master closes with a new hierarchy.'];
    return ['Spatial negotiation studio', 'Drag requirements onto the pack. Open it. Break it. Recompile it.'];
  })();

  const hint = selectedKind
    ? `${REQUIREMENTS[selectedKind].label} selected — tap a face on the pack or a surface below.`
    : placedCount === 0
      ? 'Drag a requirement card onto a package face — or tap a card, then tap a face.'
      : collision
        ? 'Move a requirement yourself — or let COMPILE solve the surface.'
        : 'Orbit freely. Scrub the object apart. Inspect the physical and informational system.';

  const sceneProps = {
    market,
    viewMode,
    decomposition: decomposition / 100,
    placements,
    pressures,
    collisionSurfaces,
    compiled,
    compilePhase,
    reflowMoves,
    interactionLocked: running,
    onPlaceConstraint: placeConstraint,
    selectedKind,
    onSelectKind: (kind) => setSelectedKind((current) => (current === kind ? null : kind)),
  };

  const statusLabel = compilePhase === 'unsolved'
    ? 'NO VALID FORM'
    : collision
      ? 'OVER CAPACITY'
      : compiled
        ? 'VALID FORM / ' + MARKETS[market].label.toUpperCase()
        : placedCount === 0
          ? 'AWAITING INPUT'
          : 'SURFACE LIVE';

  return (
    <main className={'shell mode-' + viewMode.toLowerCase() + (selectedKind ? ' is-selecting' : '')}>
      <header className="topbar">
        <div className="identity">
          <span>DAY 19 / V5.1</span>
          <strong>PACKSHIFT</strong>
        </div>

        <p className="thesis">
          Packaging is not a file.<br />
          <em>It is a compiled surface.</em>
        </p>

        <div className="actions">
          <div className="market" role="group" aria-label="Market">
            {Object.keys(MARKETS).map((value) => (
              <button
                key={value}
                className={market === value ? 'active' : ''}
                aria-pressed={market === value}
                disabled={running}
                onClick={() => changeMarket(value)}
              >
                {MARKETS[value].label.toUpperCase()}
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
          <p>{hint}</p>
        </div>

        <div className="canvas-wrap">
          <Canvas
            shadows
            flat
            dpr={[1, 1.75]}
            camera={{ position: [4.6, 2.6, 7.3], fov: 34, near: 0.1, far: 60 }}
            gl={{ antialias: true, alpha: true }}
            aria-label="3D package. Drag requirement cards onto package faces."
          >
            <Suspense fallback={null}>
              {usingFallback ? (
                <PackageScene procedural {...sceneProps} />
              ) : (
                <SceneBoundary fallback={<PackageScene procedural {...sceneProps} />} onFallback={() => setUsingFallback(true)}>
                  <PackageScene {...sceneProps} />
                </SceneBoundary>
              )}
            </Suspense>
          </Canvas>
          <Loader />
        </div>

        <aside className="view-rail" aria-label="View modes">
          {VIEWS.map(([mode, index]) => (
            <button
              key={mode}
              className={viewMode === mode ? 'active' : ''}
              aria-pressed={viewMode === mode}
              onClick={() => setMode(mode)}
              disabled={running}
              title={`${mode} (${Number(index)})`}
            >
              <span>{index}</span>{mode === 'XRAY' ? 'X-RAY' : mode}
            </button>
          ))}
        </aside>

        <div className="runtime-truth" aria-live="polite">
          <span className={'runtime-dot ' + (collision || compilePhase === 'unsolved' ? 'collision' : compiled ? 'valid' : '')}></span>
          <div>
            <b>{statusLabel}</b>
            <small>
              {collision
                ? collisionSurfaces.map((s) => SURFACE_LABEL[s]).join(' + ')
                : `${placedCount}/3 requirements placed`}
              {usingFallback ? ' · procedural fallback' : ''}
            </small>
          </div>
        </div>
        <div className="sr-only" aria-live="assertive">{announcement}</div>
      </section>

      <section className="studio-console">
        <div className="requirements" aria-label="Requirements">
          <div className="control-heading"><span>REQUIREMENTS</span><small>tap · then pick a surface</small></div>
          <div className="chips">
            {KINDS.map((kind) => (
              <div key={kind} className={'chip chip-' + kind + (selectedKind === kind ? ' selected' : '') + (placements[kind] ? ' placed' : '')}>
                <button
                  onClick={() => setSelectedKind((c) => (c === kind ? null : kind))}
                  disabled={running}
                  aria-pressed={selectedKind === kind}
                >
                  <b>{REQUIREMENTS[kind].label}</b>
                  <small>{placements[kind] ? SURFACE_LABEL[placements[kind]] : 'unplaced'}</small>
                </button>
                {placements[kind] && !running && (
                  <button className="chip-remove" onClick={() => unplace(kind)} aria-label={`Remove ${REQUIREMENTS[kind].label}`}>×</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="decompose-control">
          <div className="control-heading">
            <span>DECOMPOSE OBJECT</span>
            <strong>{Math.round(decomposition)}%</strong>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(decomposition)}
            disabled={running}
            onChange={(event) => {
              animationToken.current += 1;
              setDecomp(Number(event.target.value));
              if (!['XRAY', 'PRESSURE'].includes(viewMode)) setViewMode('CUSTOM');
            }}
            aria-label="Package decomposition"
            aria-valuetext={`${Math.round(decomposition)}%`}
          />
          <div className="range-labels">
            <span>CLOSED</span>
            <span>LID</span>
            <span>PRODUCT</span>
            <span>SHELL</span>
            <span>DIELINE</span>
          </div>
        </div>

        <div className="pressure-strip">
          {SURFACES.map((surface) => {
            const ratio = pressures[surface] || 0;
            const capacity = MARKETS[market].capacity[surface];
            const baseShare = Math.min(100, (loads[surface].base / capacity) * 100);
            const target = Boolean(selectedKind);
            return (
              <button
                key={surface}
                className={'pressure-cell ' + (ratio > 1 ? 'over' : '') + (target ? ' target' : '')}
                disabled={running || !target}
                onClick={() => target && placeConstraint(selectedKind, surface)}
                aria-label={`${SURFACE_LABEL[surface]}: ${Math.round(ratio * 100)} percent load${target ? '. Place selected requirement here.' : ''}`}
              >
                <span>{SURFACE_LABEL[surface]}</span>
                <i>
                  <em style={{ width: baseShare + '%' }} />
                  <b style={{ width: Math.min(100, ratio * 100) + '%' }} />
                </i>
                <small>{Math.round(ratio * 100)}%</small>
              </button>
            );
          })}
        </div>

        <div className="compile-actions">
          <button className="reset" onClick={undo} disabled={running || history.length === 0} title="Undo (Z)">UNDO</button>
          <button className="reset" onClick={resetStudio} disabled={running} title="Reset (R)">RESET</button>
          <button className="compile" onClick={compileSurface} disabled={running || placedCount === 0} title="Compile (C)">
            <span>COMPILE SURFACE</span>
            <small>OPEN → REFLOW → REFOLD</small>
          </button>
        </div>
      </section>

      <footer>
        <span>DRAG OR TAP REQUIREMENTS · ORBIT · 1–5 VIEWS · C COMPILE · Z UNDO</span>
        <span>CONCEPT PROTOTYPE · DEMO CAPACITIES · NOT REGULATORY OR MANUFACTURING VALIDATION</span>
      </footer>
    </main>
  );
}
