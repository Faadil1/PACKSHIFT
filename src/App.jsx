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
} from './model/pressure.js';
import { decodeState, encodeState } from './app/urlState.js';
import { dielineSVG } from './export/dieline.js';
import { isMuted, play, setMuted, unlockAudio } from './audio/sound.js';
import { Headline, PrepressMarks } from './ui/Headline.jsx';
import { InkStrip, Ticket, TicketGhost } from './ui/Ticket.jsx';

const VIEWS = [
  ['PACK', 'Pack'],
  ['EXPLODED', 'Open'],
  ['DIELINE', 'Dieline'],
  ['XRAY', 'X-ray'],
  ['PRESSURE', 'Ink'],
];
const VIEW_PRESET = { PACK: 0, EXPLODED: 44, DIELINE: 100, XRAY: 0, PRESSURE: 0 };
const STOPS = [
  [0, 'Closed'],
  [12, 'Lid'],
  [36, 'Product'],
  [70, 'Shell'],
  [100, 'Dieline'],
];
const PHASES = ['opening', 'dieline', 'reflow', 'closing'];

const reducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Pauses are reading time, kept under reduced motion; only animation is removed.
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
      <span>Loading the Blender master</span>
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
  const [tour, setTour] = useState(null);
  const [selectedKind, setSelectedKind] = useState(null);
  const [usingFallback, setUsingFallback] = useState(forceProcedural);
  const [announcement, setAnnouncement] = useState('');
  const [toast, setToast] = useState('');
  const [muted, setMutedState] = useState(isMuted);
  const [drag, setDrag] = useState(null); // { kind, x, y, vx, surface, over }
  const [resetArmed, setResetArmed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const animationToken = useRef(0);
  const decompositionRef = useRef(decomposition);
  const runningRef = useRef(false);
  const tourToken = useRef(0);
  const pickRef = useRef(null);
  const stageRef = useRef(null);

  const brief = useMemo(() => ALL_KINDS.filter((k) => Object.prototype.hasOwnProperty.call(placements, k)), [placements]);
  const pressures = useMemo(() => buildPressure(placements, market, dims), [placements, market, dims]);
  const capacity = useMemo(() => capacityFor(market, dims), [market, dims]);
  const basePressures = useMemo(
    () => Object.fromEntries(SURFACES.map((s) => [s, MARKETS[market].base[s] / capacity[s]])),
    [market, capacity],
  );
  const collisionSurfaces = useMemo(() => overloadedSurfaces(pressures), [pressures]);
  const placedCount = brief.filter((kind) => placements[kind]).length;
  const collision = collisionSurfaces.length > 0;
  const maxLoad = Math.max(...SURFACES.map((s) => pressures[s]));
  const suggestion = useMemo(
    () => (compilePhase === 'unsolved' ? suggestDims(placements, market, dims) : null),
    [compilePhase, placements, market, dims],
  );

  // Live preview of what a placement would do, before it happens.
  const preview = useMemo(() => {
    if (!drag?.kind || !drag.surface) return null;
    const next = buildPressure({ ...placements, [drag.kind]: drag.surface }, market, dims);
    return { kind: drag.kind, surface: drag.surface, from: pressures[drag.surface], to: next[drag.surface] };
  }, [drag?.kind, drag?.surface, placements, market, dims, pressures]);

  /* ----------------------------- effects ---------------------------- */

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

  useEffect(() => {
    if (running) return undefined;
    const id = setTimeout(() => {
      const hash = '#' + encodeState({ market, brief, placements, dims, viewMode });
      if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
    }, 250);
    return () => clearTimeout(id);
  }, [market, brief, placements, dims, viewMode, running]);

  // Halftone parallax (subtle, pointer-driven, skipped under reduced motion).
  useEffect(() => {
    if (reducedMotion()) return undefined;
    let raf = 0;
    const onMove = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        document.documentElement.style.setProperty('--px', x.toFixed(3));
        document.documentElement.style.setProperty('--py', y.toFixed(3));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  /* ----------------------------- helpers ---------------------------- */

  const setDecomp = useCallback((value) => {
    decompositionRef.current = value;
    setDecomposition(value);
  }, []);

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
    setTimeout(() => setToast(''), 2400);
  };

  const snapshot = () => ({ placements, dims });
  const commitPlacements = (next) => {
    setHistory((h) => [...h.slice(-29), snapshot()]);
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
    play('tick');
    setAnnouncement(`${REQUIREMENTS[kind].label} added to the job.`);
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
    setHistory((h) => [...h.slice(-29), snapshot()]);
    setDims(clampDims(next));
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

  /* --------------------------- ticket drag --------------------------- */

  const startTicketDrag = (kind) => (event) => {
    if (runningRef.current || event.button > 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let lastX = startX;
    let moved = false;
    let current = null;
    const move = (e) => {
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (!moved && dist < 6) return;
      if (!moved) {
        moved = true;
        document.body.classList.add('is-dragging-ticket');
        setSheetOpen(false);
      }
      const surface = pickRef.current?.(e.clientX, e.clientY) || null;
      const next = buildPressure({ ...placements, [kind]: surface || 'FRONT' }, market, dims);
      current = { kind, x: e.clientX, y: e.clientY, vx: e.clientX - lastX, surface, over: surface ? next[surface] > 1 : false };
      lastX = e.clientX;
      setDrag(current);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.classList.remove('is-dragging-ticket');
      setDrag(null);
      if (!moved) {
        setSelectedKind((c) => (c === kind ? null : kind));
        play('tick');
      } else if (current?.surface) {
        placeConstraint(kind, current.surface);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  /* ----------------------------- compile ----------------------------- */

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
    play(solution.valid ? 'resolve' : 'collide');
    setAnnouncement(solution.valid
      ? `Compiled. Valid form for ${MARKETS[targetMarket].label}. ${solution.moves.length} requirement(s) moved.`
      : 'No valid layout exists for this job at this carton size.');
    return solution;
  };

  const compileSurface = async () => {
    if (runningRef.current || brief.length === 0) return;
    unlockAudio();
    lock(true);
    setHistory((h) => [...h.slice(-29), snapshot()]);
    await runCompile(placements, market, dims);
    await sleep(600);
    setCompilePhase((phase) => (phase === 'valid' ? 'idle' : phase));
    lock(false);
  };

  /* ---------------------------- guided tour --------------------------- */

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
    setHistory((h) => [...h.slice(-29), snapshot()]);
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

      caption(1, 'A real Blender master', 'Folding carton, tuck flap, hinges, jar, cap, seal, insert and leaflet — exported from Blender, driven live in the browser.');
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

      caption(3, 'The front is over-inked', 'Demand exceeds the panel’s printable capacity. The proof drifts out of register instead of silently shrinking type.');
      setViewMode('PRESSURE');
      await wait(2600);

      caption(4, 'Press: open, reflow, refold', 'The lid opens, the product lifts out, the carton unfolds, and each requirement flies to the panel that can hold it.');
      const eu = await runCompile(IMPOSSIBLE_FRONT, 'EU', NOMINAL_DIMS, guard);
      await wait(1400);

      caption(5, 'Same master, new market', 'Canada reserves the left panel for bilingual statements. The solver finds a different valid layout.');
      setMarket('CANADA');
      setCompiled(false);
      await wait(900);
      const ca = await runCompile(eu.placements, 'CANADA', NOMINAL_DIMS, guard);
      await wait(1200);

      caption(6, 'Grow the job', 'Add warnings, an eco claim and a retail barcode. Nothing fits any more — and the proof says so.');
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

      caption(8, 'Your turn', 'Drag a ticket onto a face, scrub the object apart, change the stock — then share the proof or export the dieline.');
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
    if (!resetArmed) {
      // Destructive: ask for a second press instead of a modal.
      setResetArmed(true);
      setTimeout(() => setResetArmed(false), 2200);
      return;
    }
    setResetArmed(false);
    animationToken.current += 1;
    setHistory((h) => [...h.slice(-29), snapshot()]);
    setPlacements(emptyPlacements());
    setDims(NOMINAL_DIMS);
    setDecomp(0);
    setViewMode('PACK');
    setCompiled(false);
    setCompilePhase('idle');
    setSelectedKind(null);
    setReflowMoves([]);
    setLastDiff(null);
    flash('Fresh proof. Undo (Z) brings the last one back.');
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

  const shareLink = async () => {
    const url = window.location.origin + window.location.pathname + '#' + encodeState({ market, brief, placements, dims, viewMode });
    try {
      await navigator.clipboard.writeText(url);
      flash('Proof link copied — it reopens this exact state.');
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
    flash('Concept dieline exported · SVG · mm');
  };

  const toggleSound = () => {
    unlockAudio();
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) play('tick');
  };

  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.('input, select, textarea') || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'escape') {
        if (tour) skipTour();
        setSelectedKind(null);
        setSheetOpen(false);
        return;
      }
      if (event.target.closest?.('button') && (key === 'enter' || key === ' ')) return;
      if (key >= '1' && key <= '5') setMode(VIEWS[Number(key) - 1][0]);
      else if (key === 'c') compileSurface();
      else if (key === 'r') resetStudio();
      else if (key === 'z') undo();
      else if (key === 't') runTour();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ------------------------------ copy ------------------------------ */

  const marketLabel = MARKETS[market].label;
  const sceneCopy = (() => {
    if (compilePhase === 'opening') return ['Pressing · 1/4', 'Tuck out. Lid up. Product out.'];
    if (compilePhase === 'dieline') return ['Pressing · 2/4', 'Every surface is on the table.'];
    if (compilePhase === 'reflow') return ['Pressing · 3/4', 'Requirements find their panel.'];
    if (compilePhase === 'closing') return ['Pressing · 4/4', 'Same master. New hierarchy.'];
    if (compilePhase === 'unsolved') return ['Proof rejected', 'Nothing fits this stock.'];
    if (collision) {
      const which = collisionSurfaces.map((s) => SURFACE_LABEL[s].toLowerCase()).join(' + ');
      return [collisionSurfaces.includes('FRONT') ? 'Impossible front' : 'Over-inked', `The ${which} refuses the brief.`];
    }
    if (viewMode === 'EXPLODED') return ['Open', 'One object. Nine parts.'];
    if (viewMode === 'DIELINE') return ['Dieline', 'Flat, printed, negotiable.'];
    if (viewMode === 'XRAY') return ['X-ray', 'More than its skin.'];
    if (viewMode === 'PRESSURE') return ['Ink load', 'Demand, made visible.'];
    if (compiled) return [`In register · ${marketLabel}`, 'The package made room.'];
    if (placedCount === 0) return ['Proof room', 'Packaging is a compiled surface.'];
    return ['Proof live', 'Place. Overload. Press.'];
  })();

  const headlineState = compilePhase === 'unsolved' || (collision && !running)
    ? 'misregistered'
    : compiled
      ? 'registered'
      : 'idle';

  const hint = drag
    ? (drag.surface ? `Release to print on ${SURFACE_LABEL[drag.surface]}.` : 'Move over a face of the pack.')
    : selectedKind
      ? `${REQUIREMENTS[selectedKind].label} lifted — tap a face on the pack or an ink column.`
      : placedCount === 0
        ? 'Drag a ticket onto a face of the pack.'
        : collision
          ? 'Move a ticket yourself, or hit PRESS and let the solver negotiate.'
          : 'Orbit, scrub the timeline, or press to compile.';

  const statusTone = compilePhase === 'unsolved' || collision ? 'hot' : compiled ? 'ok' : placedCount ? 'live' : 'idle';
  const statusWord = compilePhase === 'unsolved'
    ? 'REJECTED'
    : collision
      ? 'OVER-INKED'
      : compiled
        ? 'IN REGISTER'
        : placedCount
          ? 'LIVE'
          : 'AWAITING';

  const nominal = isNominal(dims);
  const geometrySource = usingFallback || !nominal ? 'PROCEDURAL TWIN' : 'BLENDER MASTER 0.6.0';
  const wdth = Math.round(125 - Math.min(1.4, Math.max(0, maxLoad)) / 1.4 * 55);
  const phaseIndex = PHASES.indexOf(compilePhase);

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
    interactionLocked: running || Boolean(drag),
    onPlaceConstraint: placeConstraint,
    selectedKind,
    hoverSurface: drag?.surface || null,
    preview,
    onPickerReady: (fn) => { pickRef.current = fn; },
  };

  const pressClass = running ? 'running' : collision ? 'hot' : placedCount ? 'ready' : 'idle';

  return (
    <main
      className={`room tone-${statusTone} mode-${viewMode.toLowerCase()}${selectedKind ? ' is-selecting' : ''}${tour ? ' is-touring' : ''}${running ? ' is-running' : ''}`}
      style={{ '--wdth': wdth, '--load': Math.min(1.4, maxLoad).toFixed(3) }}
    >
      <div className="halftone" aria-hidden="true" />

      <header className="masthead">
        <div className="wordmark">
          <strong>PACK<span>SHIFT</span></strong>
          <small>Proof room · Day 19 · v5.3</small>
        </div>

        <div className="plates" role="group" aria-label="Market plate">
          {Object.keys(MARKETS).map((value, i) => (
            <button
              key={value}
              className={'plate plate-' + i + (market === value ? ' active' : '')}
              aria-pressed={market === value}
              disabled={running}
              onClick={() => changeMarket(value)}
              title={MARKETS[value].note}
            >
              <i aria-hidden="true" />
              {value === 'CANADA' ? 'CA' : value}
            </button>
          ))}
        </div>

        <nav className="tools" aria-label="Tools">
          <button onClick={tour ? skipTour : runTour} disabled={running && !tour} className="tool-tour">
            {tour ? 'Skip tour' : 'Guided tour'}<kbd>T</kbd>
          </button>
          <button onClick={shareLink} disabled={running} title="Copy a link to this exact proof">Share</button>
          <button onClick={exportDieline} disabled={running} title="Export the concept dieline (SVG, mm)">Dieline ⤓</button>
          <button onClick={toggleSound} aria-pressed={!muted} title="Sound" className="tool-sound">
            <span className={'bars' + (muted ? ' off' : '')} aria-hidden="true"><i /><i /><i /></span>
            <span className="sr-only">{muted ? 'Sound off' : 'Sound on'}</span>
          </button>
        </nav>
      </header>

      <aside className={'job' + (sheetOpen ? ' open' : '')} aria-label="Job ticket">
        <button className="job-handle" onClick={() => setSheetOpen((o) => !o)} aria-expanded={sheetOpen}>
          <span />Job · {placedCount}/{brief.length} placed
        </button>
        <div className="job-head">
          <span>JOB TICKET</span>
          <b>{brief.length} req · {marketLabel}</b>
        </div>
        <ul className="tickets">
          {brief.map((kind, i) => (
            <Ticket
              key={kind}
              index={i}
              kind={kind}
              weight={MARKETS[market].weight[kind] / capacity[placements[kind] || REQUIREMENTS[kind].preferred]}
              placed={placements[kind]}
              selected={selectedKind === kind}
              dragging={drag?.kind === kind}
              disabled={running}
              onPointerDown={startTicketDrag(kind)}
              onKeySelect={() => setSelectedKind((c) => (c === kind ? null : kind))}
              onUnplace={() => unplace(kind)}
              onRemove={() => removeFromBrief(kind)}
            />
          ))}
        </ul>
        {ALL_KINDS.some((k) => !brief.includes(k)) && (
          <div className="add">
            <span>ADD TO JOB</span>
            {ALL_KINDS.filter((k) => !brief.includes(k)).map((kind) => (
              <button key={kind} onClick={() => addToBrief(kind)} disabled={running} style={{ '--ink': REQUIREMENTS[kind].color }}>
                + {REQUIREMENTS[kind].label}
              </button>
            ))}
          </div>
        )}
        <div className="stock">
          <div className="job-head">
            <span>STOCK</span>
            <b>{nominal ? 'Blender master' : 'Custom · twin'}</b>
          </div>
          {['width', 'depth', 'height'].map((key) => (
            <label key={key} className="stock-row">
              <span>{key[0].toUpperCase()}</span>
              <input
                type="range"
                min={DIM_LIMITS[key][0]}
                max={DIM_LIMITS[key][1]}
                value={dims[key]}
                disabled={running}
                onChange={(e) => changeDims({ ...dims, [key]: Number(e.target.value) })}
                aria-label={`Carton ${key} in millimetres`}
              />
              <output>{dims[key]}</output>
            </label>
          ))}
          {!nominal && <button className="stock-reset" onClick={() => changeDims(NOMINAL_DIMS)} disabled={running}>Back to 56 × 36 × 130</button>}
        </div>
      </aside>

      <section className={'stage' + (collision ? ' has-collision' : '')} ref={stageRef}>
        <PrepressMarks state={headlineState} />

        <div className="scene-copy">
          <span className="eyebrow">{sceneCopy[0]}</span>
          <Headline text={sceneCopy[1]} state={headlineState} />
          <p>{hint}</p>
        </div>

        <div className="canvas-wrap">
          <Canvas
            shadows
            flat
            dpr={[1, 1.75]}
            camera={{ position: [4.6, 2.6, 7.3], fov: 34, near: 0.1, far: 80 }}
            gl={{ antialias: true, alpha: true }}
            aria-label="3D package. Drag job tickets onto its faces."
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

        {lastDiff && lastDiff.moves.length > 0 && !running && (
          <div className="report" role="status">
            <span>REGISTER REPORT · {lastDiff.moves.length} moved</span>
            <ul>
              {lastDiff.moves.map((m, i) => (
                <li key={m.kind} style={{ '--ink': REQUIREMENTS[m.kind].color, '--i': i }}>
                  <b>{REQUIREMENTS[m.kind].label}</b>
                  <em>{m.from ? SURFACE_LABEL[m.from] : '—'}</em>
                  <i aria-hidden="true">→</i>
                  <strong>{SURFACE_LABEL[m.to]}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {compilePhase === 'unsolved' && !running && (
          <div className="rejected" role="alert">
            <span>PROOF REJECTED</span>
            <b>{brief.length} requirements · {dims.width} × {dims.depth} × {dims.height} mm · {marketLabel}</b>
            {suggestion ? (
              <button onClick={() => changeDims(suggestion)}>
                Grow stock to {suggestion.width} × {suggestion.depth} × {suggestion.height} mm
              </button>
            ) : <em>No stock within limits holds this job — remove a requirement.</em>}
          </div>
        )}

        {tour && (
          <div className="tour" role="status" aria-live="polite">
            <div className="tour-dots" aria-hidden="true">
              {Array.from({ length: tour.total }, (_, i) => <i key={i} className={i < tour.step ? 'on' : ''} />)}
            </div>
            <span>{String(tour.step).padStart(2, '0')} / {String(tour.total).padStart(2, '0')}</span>
            <b key={tour.title}>{tour.title}</b>
            <p key={tour.body}>{tour.body}</p>
            <button onClick={skipTour}>Skip · Esc</button>
          </div>
        )}

        {toast && <div className="toast" role="status">{toast}</div>}
        <div className="sr-only" aria-live="assertive">{announcement}</div>
      </section>

      <aside className="inks" aria-label="Ink load">
        <div className="job-head"><span>INK LOAD</span><b>{Math.round(maxLoad * 100)}% peak</b></div>
        <InkStrip
          pressures={pressures}
          basePressures={basePressures}
          preview={preview}
          target={Boolean(selectedKind)}
          disabled={running}
          onPick={(surface) => selectedKind && placeConstraint(selectedKind, surface)}
        />
        <p className="inks-legend"><i className="k" />base <i className="c" />placed <i className="m" />over</p>
      </aside>

      <footer className="deck">
        <div className="timeline">
          <div className="views" role="group" aria-label="Views">
            {VIEWS.map(([mode, label], i) => (
              <button key={mode} className={viewMode === mode ? 'active' : ''} aria-pressed={viewMode === mode} onClick={() => setMode(mode)} disabled={running}>
                <kbd>{i + 1}</kbd>{label}
              </button>
            ))}
          </div>
          <div className="ruler">
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
              aria-label="Decompose the package"
              aria-valuetext={`${Math.round(decomposition)}%`}
              style={{ '--v': decomposition }}
            />
            <div className="ticks" aria-hidden="true">
              {Array.from({ length: 41 }, (_, i) => <i key={i} className={i % 5 === 0 ? 'major' : ''} />)}
            </div>
            <div className="stops" aria-hidden="true">
              {STOPS.map(([at, label]) => <span key={label} style={{ left: at + '%' }} className={decomposition >= at - 1 ? 'passed' : ''}>{label}</span>)}
            </div>
          </div>
        </div>

        <div className="press-cluster">
          <button className="ghost" onClick={undo} disabled={running || history.length === 0} title="Undo (Z)">Undo</button>
          <button className={'ghost' + (resetArmed ? ' armed' : '')} onClick={resetStudio} disabled={running} title="Reset (R)">
            {resetArmed ? 'Sure?' : 'Reset'}
          </button>
          <button
            className={'press ' + pressClass}
            onClick={compileSurface}
            disabled={running || brief.length === 0}
            aria-label="Press: compile the surface (C)"
            style={{ '--phase': phaseIndex < 0 ? 0 : (phaseIndex + 1) / PHASES.length }}
          >
            <span className="press-ring" aria-hidden="true" />
            <b>{running ? (phaseIndex >= 0 ? `${phaseIndex + 1}/4` : '···') : 'PRESS'}</b>
            <small>{running ? 'compiling' : 'compile · C'}</small>
          </button>
        </div>
      </footer>

      <div className={'slug tone-' + statusTone} aria-live="polite">
        <b>{statusWord}</b>
        <span>{marketLabel.toUpperCase()}</span>
        <span>{dims.width}×{dims.depth}×{dims.height} MM</span>
        <span>{placedCount}/{brief.length} PLACED</span>
        {collision && <span className="hot">{collisionSurfaces.map((s) => `${SURFACE_LABEL[s].toUpperCase()} ${Math.round(pressures[s] * 100)}%`).join(' · ')}</span>}
        <span className="dim">{geometrySource}</span>
        <span className="dim grow">CONCEPT · DEMO CAPACITIES · NOT REGULATORY OR MANUFACTURING VALIDATION</span>
      </div>

      <TicketGhost drag={drag} />
    </main>
  );
}
