import React, { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { PackageScene, flightDuration } from './scene/PackageScene.jsx';
import {
  ALL_KINDS,
  DIM_LIMITS,
  IMPOSSIBLE_FRONT,
  MARKETS,
  NOMINAL_DIMS,
  REQUIREMENTS,
  SURFACES,
  SURFACE_LABEL,
  buildPressure,
  capacityFor,
  clampDims,
  emptyPlacements,
  isNominal,
  overloadedSurfaces,
  solvePlacements,
  suggestDims,
  surfaceLoads,
} from './model/pressure.js';
import { decodeState, encodeState } from './app/urlState.js';
import { dielineSVG } from './export/dieline.js';
import { isMuted, play, setMuted, unlockAudio } from './audio/sound.js';

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

class Cancelled extends Error {}

class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('PACKSHIFT: Blender master failed to load, using procedural twin.', error);
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

const initial = (() => {
  if (typeof window === 'undefined') return null;
  try {
    return decodeState(window.location.hash);
  } catch {
    return null;
  }
})();

export default function App() {
  const [market, setMarket] = useState(initial?.market || 'EU');
  const [viewMode, setViewMode] = useState(initial?.viewMode || 'PACK');
  const [decomposition, setDecomposition] = useState(initial ? VIEW_PRESET[initial.viewMode] || 0 : 0);
  const [placements, setPlacements] = useState(initial?.placements || emptyPlacements());
  const [dims, setDims] = useState(initial?.dims || NOMINAL_DIMS);
  const [history, setHistory] = useState([]);
  const [compiled, setCompiled] = useState(false);
  const [compilePhase, setCompilePhase] = useState('idle');
  const [reflowMoves, setReflowMoves] = useState([]);
  const [lastDiff, setLastDiff] = useState(null);
  const [running, setRunning] = useState(false);
  const [tour, setTour] = useState(null); // { step, total, title, body }
  const [selectedKind, setSelectedKind] = useState(null);
  const [usingFallback, setUsingFallback] = useState(forceProcedural);
  const [announcement, setAnnouncement] = useState('');
  const [toast, setToast] = useState('');
  const [sizeOpen, setSizeOpen] = useState(false);
  const [muted, setMutedState] = useState(isMuted);

  const animationToken = useRef(0);
  const decompositionRef = useRef(decomposition);
  const runningRef = useRef(false);
  const tourToken = useRef(0);
  const placementsRef = useRef(placements);
  placementsRef.current = placements;

  const brief = useMemo(() => ALL_KINDS.filter((k) => Object.prototype.hasOwnProperty.call(placements, k)), [placements]);
  const pressures = useMemo(() => buildPressure(placements, market, dims), [placements, market, dims]);
  const loads = useMemo(() => surfaceLoads(placements, market), [placements, market]);
  const capacity = useMemo(() => capacityFor(market, dims), [market, dims]);
  const collisionSurfaces = useMemo(() => overloadedSurfaces(pressures), [pressures]);
  const placedCount = brief.filter((kind) => placements[kind]).length;
  const collision = collisionSurfaces.length > 0;
  const suggestion = useMemo(
    () => (compilePhase === 'unsolved' ? suggestDims(placements, market, dims) : null),
    [compilePhase, placements, market, dims],
  );

  // Sound: unlock on first gesture (autoplay policy); collision thud on edge.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  const wasColliding = useRef(false);
  useEffect(() => {
    if (collision && !wasColliding.current) play('collide');
    wasColliding.current = collision;
  }, [collision]);

  // Shareable link: keep the URL hash in sync with the studio (not mid-run).
  useEffect(() => {
    if (running) return undefined;
    const id = setTimeout(() => {
      const hash = '#' + encodeState({ market, brief, placements, dims, viewMode });
      if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
    }, 250);
    return () => clearTimeout(id);
  }, [market, brief, placements, dims, viewMode, running]);

  const setDecomp = useCallback((value) => {
    decompositionRef.current = value;
    setDecomposition(value);
  }, []);

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

  const flash = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
  };

  const commitPlacements = (next) => {
    setHistory((h) => [...h.slice(-29), { placements, dims }]);
    setPlacements(next);
    setLastDiff(null);
  };

  const setMode = (mode) => {
    if (runningRef.current) return;
    setViewMode(mode);
    play('tick');
    animateDecomposition(VIEW_PRESET[mode] ?? decompositionRef.current, 700);
  };

  const placeConstraint = (kind, surface) => {
    if (runningRef.current) return;
    setSelectedKind(null);
    if (placements[kind] === surface) return;
    setCompiled(false);
    setCompilePhase('idle');
    commitPlacements({ ...placements, [kind]: surface });
    play('crease', { intensity: 0.7 });
    setAnnouncement(`${REQUIREMENTS[kind].label} placed on ${SURFACE_LABEL[surface]}.`);
  };

  const unplace = (kind) => {
    if (runningRef.current || !placements[kind]) return;
    commitPlacements({ ...placements, [kind]: null });
    setCompiled(false);
  };

  const addToBrief = (kind) => {
    if (runningRef.current || kind in placements) return;
    commitPlacements({ ...placements, [kind]: null });
    setCompiled(false);
    setCompilePhase('idle');
    setAnnouncement(`${REQUIREMENTS[kind].label} added to the brief.`);
  };

  const removeFromBrief = (kind) => {
    if (runningRef.current || REQUIREMENTS[kind].core) return;
    const next = { ...placements };
    delete next[kind];
    commitPlacements(next);
    setCompiled(false);
    setCompilePhase('idle');
    if (selectedKind === kind) setSelectedKind(null);
  };

  const changeDims = (next) => {
    const clamped = clampDims(next);
    setHistory((h) => [...h.slice(-29), { placements, dims }]);
    setDims(clamped);
    setCompiled(false);
    setCompilePhase((p) => (p === 'unsolved' ? 'idle' : p));
    setLastDiff(null);
  };

  const undo = () => {
    if (runningRef.current || history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setPlacements(previous.placements);
    setDims(previous.dims);
    setCompiled(false);
    setCompilePhase('idle');
    setLastDiff(null);
    setAnnouncement('Undid last change.');
  };

  const runCompile = async (from, targetMarket, targetDims, guard = () => {}) => {
    const solution = solvePlacements(from, targetMarket, targetDims);
    setCompiled(false);
    setSelectedKind(null);
    setLastDiff(null);

    setCompilePhase('opening');
    setViewMode('EXPLODED');
    await animateDecomposition(46, 1300);
    guard();

    setCompilePhase('dieline');
    setViewMode('DIELINE');
    await animateDecomposition(100, 1000);
    await sleep(250);
    guard();

    setCompilePhase('reflow');
    setReflowMoves(solution.moves);
    // Placements change only when the flying blocks land.
    await sleep(Math.max(700, flightDuration(solution.moves.length) * 1000));
    setPlacements(solution.placements);
    await sleep(450);
    guard();

    setCompilePhase('closing');
    setViewMode('PACK');
    setReflowMoves([]);
    await animateDecomposition(0, 1600);
    guard();

    setCompiled(solution.valid);
    setCompilePhase(solution.valid ? 'valid' : 'unsolved');
    setLastDiff({ moves: solution.moves, market: targetMarket, valid: solution.valid });
    if (solution.valid) play('resolve');
    else play('collide');
    setAnnouncement(solution.valid
      ? `Compiled. Valid form for ${MARKETS[targetMarket].label}. ${solution.moves.length} requirement(s) moved.`
      : 'No valid layout exists for this brief at this carton size.');
    return solution;
  };

  const compileSurface = async () => {
    if (runningRef.current || brief.length === 0) return;
    unlockAudio();
    lock(true);
    setHistory((h) => [...h.slice(-29), { placements, dims }]);
    await runCompile(placements, market, dims);
    await sleep(600);
    setCompilePhase((phase) => (phase === 'valid' ? 'idle' : phase));
    lock(false);
  };

  /* -------------------------- guided tour -------------------------- */

  const TOUR_STEPS = 8;
  const runTour = async () => {
    if (runningRef.current) return;
    unlockAudio();
    const token = ++tourToken.current;
    const guard = () => {
      if (token !== tourToken.current) throw new Cancelled();
    };
    const caption = (step, title, body) => {
      guard();
      setTour({ step, total: TOUR_STEPS, title, body });
    };
    const wait = async (ms) => {
      await sleep(ms);
      guard();
    };

    lock(true);
    setHistory((h) => [...h.slice(-29), { placements, dims }]);
    try {
      animationToken.current += 1;
      setCompiled(false);
      setCompilePhase('idle');
      setSelectedKind(null);
      setMarket('EU');
      setDims(NOMINAL_DIMS);
      setViewMode('PACK');
      setDecomp(0);
      setPlacements(emptyPlacements());
      setLastDiff(null);

      caption(1, 'A real Blender master', 'Folding carton, hinges, jar, cap, seal, insert and leaflet — exported from Blender, driven live in the browser.');
      await wait(900);
      setViewMode('XRAY');
      await wait(2600);
      setViewMode('PACK');

      caption(2, 'Put everything on the front', 'Language copy, a data carrier and a marketing claim all fight for the same panel.');
      await wait(700);
      setPlacements({ language: 'FRONT', data: null, claim: null });
      play('crease', { intensity: 0.7 });
      await wait(750);
      setPlacements({ language: 'FRONT', data: 'FRONT', claim: null });
      play('crease', { intensity: 0.7 });
      await wait(750);
      setPlacements(IMPOSSIBLE_FRONT);

      caption(3, 'The front refuses the brief', 'Demand exceeds the panel’s printable capacity. The surface turns red instead of silently shrinking type.');
      setViewMode('PRESSURE');
      await wait(2600);

      caption(4, 'Compile: open, reflow, refold', 'The lid opens, the product lifts out, the carton unfolds, and each requirement flies to the panel that can hold it.');
      const eu = await runCompile(IMPOSSIBLE_FRONT, 'EU', NOMINAL_DIMS, guard);
      await wait(1400);

      caption(5, 'Same master, new market', 'Canada reserves the left panel for bilingual statements. The solver finds a different valid layout.');
      setMarket('CANADA');
      setCompiled(false);
      await wait(900);
      const ca = await runCompile(eu.placements, 'CANADA', NOMINAL_DIMS, guard);
      await wait(1200);

      caption(6, 'Grow the brief', 'Add warnings, an eco claim and a retail barcode. Nothing fits any more — and the studio says so.');
      const grown = { ...ca.placements, warning: null, eco: null, barcode: null };
      setPlacements(grown);
      await wait(1300);
      await runCompile(grown, 'CANADA', NOMINAL_DIMS, guard);
      await wait(1800);

      const bigger = suggestDims(grown, 'CANADA', NOMINAL_DIMS) || NOMINAL_DIMS;
      caption(7, `+${bigger.width - NOMINAL_DIMS.width} mm solves it`, `The solver computes the smallest carton that fits: ${bigger.width} × ${bigger.depth} × ${bigger.height} mm. Same hinges, rebuilt geometry.`);
      setDims(bigger);
      await wait(1600);
      await runCompile(grown, 'CANADA', bigger, guard);
      await wait(1300);

      caption(8, 'Your turn', 'Drag requirements, scrub the object apart, change the size — then share the link or export the dieline.');
      await wait(3600);
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
      animationToken.current += 1;
      setReflowMoves([]);
      setDecomp(0);
      setViewMode('PACK');
    } finally {
      if (token === tourToken.current) tourToken.current += 1;
      setTour(null);
      setCompilePhase((phase) => (phase === 'unsolved' ? phase : 'idle'));
      lock(false);
    }
  };

  const skipTour = () => {
    tourToken.current += 1;
  };

  const resetStudio = () => {
    if (runningRef.current) return;
    animationToken.current += 1;
    setHistory((h) => [...h.slice(-29), { placements, dims }]);
    setPlacements(emptyPlacements());
    setDims(NOMINAL_DIMS);
    setDecomp(0);
    setViewMode('PACK');
    setCompiled(false);
    setCompilePhase('idle');
    setSelectedKind(null);
    setReflowMoves([]);
    setLastDiff(null);
  };

  const changeMarket = (value) => {
    if (runningRef.current || value === market) return;
    setMarket(value);
    setCompiled(false);
    setCompilePhase('idle');
    setLastDiff(null);
    play('tick');
    setAnnouncement(`Market set to ${MARKETS[value].label}. ${MARKETS[value].note}`);
  };

  /* ---------------------------- tools ---------------------------- */

  const shareLink = async () => {
    const url = window.location.origin + window.location.pathname + '#' + encodeState({ market, brief, placements, dims, viewMode });
    try {
      await navigator.clipboard.writeText(url);
      flash('Link copied — it reopens this exact studio state.');
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  const exportDieline = () => {
    const svg = dielineSVG({ dims, market, placements, pressures, valid: compiled });
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `packshift-dieline-${market.toLowerCase()}-${dims.width}x${dims.depth}x${dims.height}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash('Concept dieline exported (SVG, mm).');
  };

  const toggleSound = () => {
    unlockAudio();
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) play('tick');
  };

  // Keyboard: 1-5 views, C compile, R reset, Z undo, T tour, Esc deselect/skip.
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.('input, select, textarea') || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'escape') {
        if (tour) skipTour();
        setSelectedKind(null);
        setSizeOpen(false);
        return;
      }
      if (key >= '1' && key <= '5') setMode(VIEWS[Number(key) - 1][0]);
      else if (key === 'c') compileSurface();
      else if (key === 'r') resetStudio();
      else if (key === 'z') undo();
      else if (key === 't') runTour();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const marketLabel = MARKETS[market].label;
  const sceneCopy = (() => {
    if (compilePhase === 'opening') return ['Open the object', 'Tuck out, lid up. The product lifts out through the opening.'];
    if (compilePhase === 'dieline') return ['Dieline field', 'Every printable surface is now part of the conversation.'];
    if (compilePhase === 'reflow') return ['Spatial reflow', 'Each requirement travels to the panel that can hold it.'];
    if (compilePhase === 'closing') return ['Refold', 'The same master closes around a new hierarchy.'];
    if (compilePhase === 'unsolved') return ['No valid form', 'No layout fits this brief on this carton. Shrink the brief or grow the pack.'];
    if (collision) {
      const which = collisionSurfaces.map((s) => SURFACE_LABEL[s].toLowerCase()).join(' + ');
      return [collisionSurfaces.includes('FRONT') ? 'Impossible front' : 'Over capacity', `The ${which} is refusing the brief.`];
    }
    if (viewMode === 'EXPLODED') return ['Open the object', 'Lid, product, insert and leaflet come apart as one system.'];
    if (viewMode === 'DIELINE') return ['Dieline field', 'Every printable surface is now part of the conversation.'];
    if (viewMode === 'XRAY') return ['X-ray', 'The package is more than its skin.'];
    if (viewMode === 'PRESSURE') return ['Pressure map', 'Surface demand becomes visible before it becomes a problem.'];
    if (compiled) return ['Valid form', `The same master closes with a new hierarchy for ${marketLabel}.`];
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
    dims,
    market,
    viewMode,
    decomposition: decomposition / 100,
    placements,
    brief,
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
        ? 'VALID FORM / ' + marketLabel.toUpperCase()
        : placedCount === 0
          ? 'AWAITING INPUT'
          : 'SURFACE LIVE';

  const nominal = isNominal(dims);
  const geometrySource = usingFallback || !nominal ? 'procedural twin' : 'Blender master';

  return (
    <main className={'shell mode-' + viewMode.toLowerCase() + (selectedKind ? ' is-selecting' : '') + (tour ? ' is-touring' : '')}>
      <header className="topbar">
        <div className="identity">
          <span>DAY 19 / V5.2</span>
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
                title={MARKETS[value].note}
              >
                {value === 'CANADA' ? 'CA' : value}
              </button>
            ))}
          </div>
          <div className="tools" role="group" aria-label="Tools">
            <button onClick={toggleSound} aria-pressed={!muted} title={muted ? 'Sound off' : 'Sound on'}>
              <span aria-hidden="true">{muted ? '◌' : '◉'}</span><em>{muted ? 'SOUND OFF' : 'SOUND'}</em>
            </button>
            <button onClick={shareLink} disabled={running} title="Copy a link to this exact state">
              <span aria-hidden="true">↗</span><em>SHARE</em>
            </button>
            <button onClick={exportDieline} disabled={running} title="Export the concept dieline (SVG, mm)">
              <span aria-hidden="true">⤓</span><em>DIELINE</em>
            </button>
          </div>
          <button className="run-demo" onClick={tour ? skipTour : runTour} disabled={running && !tour}>
            {tour ? 'SKIP TOUR' : running ? 'COMPILING…' : 'GUIDED TOUR'}
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
            camera={{ position: [4.6, 2.6, 7.3], fov: 34, near: 0.1, far: 80 }}
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
                : `${placedCount}/${brief.length} requirements placed`}
              {' · '}{geometrySource}
            </small>
            {lastDiff && lastDiff.moves.length > 0 && !running && (
              <ul className="diff">
                {lastDiff.moves.map((m) => (
                  <li key={m.kind}>
                    <i style={{ background: REQUIREMENTS[m.kind].color }} />
                    <b>{REQUIREMENTS[m.kind].label}</b>
                    <span>{m.from ? SURFACE_LABEL[m.from] : 'unplaced'} → {SURFACE_LABEL[m.to]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {compilePhase === 'unsolved' && !running && (
          <div className="unsolved" role="alert">
            <b>No layout fits {brief.length} requirements on {dims.width} × {dims.depth} × {dims.height} mm in {marketLabel}.</b>
            {suggestion ? (
              <button onClick={() => changeDims(suggestion)}>
                Grow carton to {suggestion.width} × {suggestion.depth} × {suggestion.height} mm
              </button>
            ) : <span>Remove a requirement — no carton within limits can hold this brief.</span>}
          </div>
        )}

        {tour && (
          <div className="tour" role="status" aria-live="polite">
            <div className="tour-dots" aria-hidden="true">
              {Array.from({ length: tour.total }, (_, i) => <i key={i} className={i < tour.step ? 'on' : ''} />)}
            </div>
            <b>{tour.title}</b>
            <p>{tour.body}</p>
            <button onClick={skipTour}>Skip tour (Esc)</button>
          </div>
        )}

        {toast && <div className="toast" role="status">{toast}</div>}
        <div className="sr-only" aria-live="assertive">{announcement}</div>
      </section>

      {sizeOpen && (
        <div className="size-panel" role="dialog" aria-label="Carton size">
          <div className="control-heading">
            <span>CARTON SIZE (mm)</span>
            <button onClick={() => setSizeOpen(false)} aria-label="Close carton size">×</button>
          </div>
          {['width', 'depth', 'height'].map((key) => (
            <label key={key}>
              <span>{key}</span>
              <input
                type="range"
                min={DIM_LIMITS[key][0]}
                max={DIM_LIMITS[key][1]}
                value={dims[key]}
                disabled={running}
                onChange={(e) => changeDims({ ...dims, [key]: Number(e.target.value) })}
              />
              <strong>{dims[key]}</strong>
            </label>
          ))}
          <p>
            Capacity scales with panel area. The Blender master is authored at 56 × 36 × 130; other sizes rebuild the
            same hierarchy as a procedural twin.
          </p>
          <button className="size-reset" disabled={running || nominal} onClick={() => changeDims(NOMINAL_DIMS)}>Back to Blender master size</button>
        </div>
      )}

      <section className="studio-console">
        <div className="requirements" aria-label="Brief">
          <div className="control-heading"><span>BRIEF</span><small>tap · then pick a surface</small></div>
          <div className="chips">
            {brief.map((kind) => (
              <div key={kind} className={'chip' + (selectedKind === kind ? ' selected' : '') + (placements[kind] ? ' placed' : '')} style={{ '--chip': REQUIREMENTS[kind].color }}>
                <button
                  onClick={() => setSelectedKind((c) => (c === kind ? null : kind))}
                  disabled={running}
                  aria-pressed={selectedKind === kind}
                >
                  <b>{REQUIREMENTS[kind].label}</b>
                  <small>{placements[kind] ? SURFACE_LABEL[placements[kind]] : 'unplaced'}</small>
                </button>
                {!running && (placements[kind] || !REQUIREMENTS[kind].core) && (
                  <button
                    className="chip-remove"
                    onClick={() => (placements[kind] ? unplace(kind) : removeFromBrief(kind))}
                    aria-label={placements[kind] ? `Unplace ${REQUIREMENTS[kind].label}` : `Remove ${REQUIREMENTS[kind].label} from brief`}
                    title={placements[kind] ? 'Unplace' : 'Remove from brief'}
                  >
                    {placements[kind] ? '×' : '−'}
                  </button>
                )}
              </div>
            ))}
          </div>
          {ALL_KINDS.some((k) => !brief.includes(k)) && (
            <div className="add-row">
              <span>ADD</span>
              {ALL_KINDS.filter((k) => !brief.includes(k)).map((kind) => (
                <button key={kind} onClick={() => addToBrief(kind)} disabled={running} style={{ '--chip': REQUIREMENTS[kind].color }}>
                  + {REQUIREMENTS[kind].label}
                </button>
              ))}
            </div>
          )}
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
          <button className="size-toggle" onClick={() => setSizeOpen((o) => !o)} aria-expanded={sizeOpen} disabled={running}>
            CARTON {dims.width} × {dims.depth} × {dims.height} mm <em>{nominal ? 'Blender master' : 'custom'}</em>
          </button>
        </div>

        <div className="pressure-strip">
          {SURFACES.map((surface) => {
            const ratio = pressures[surface] || 0;
            const baseShare = Math.min(100, (loads[surface].base / capacity[surface]) * 100);
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
          <button className="compile" onClick={compileSurface} disabled={running || brief.length === 0} title="Compile (C)">
            <span>COMPILE SURFACE</span>
            <small>OPEN → REFLOW → REFOLD</small>
          </button>
        </div>
      </section>

      <footer>
        <span>DRAG OR TAP · ORBIT · 1–5 VIEWS · C COMPILE · Z UNDO · T TOUR</span>
        <span>CONCEPT PROTOTYPE · DEMO CAPACITIES · NOT REGULATORY OR MANUFACTURING VALIDATION</span>
      </footer>
    </main>
  );
}
