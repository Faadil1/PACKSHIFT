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
  emptyPlacements,
  isNominal,
  clampDims,
  overloadedSurfaces,
  solvePlacements,
  suggestDims,
} from './model/pressure.js';
import { decodeState, encodeState } from './app/urlState.js';
import { dielineSVG } from './export/dieline.js';
import { isMuted, play, setMuted, unlockAudio } from './audio/sound.js';
import { CALM, CAST, Character, LOUD, useFlip } from './ui/Character.jsx';
import { ColumnHeadline } from './ui/ColumnHeadline.jsx';

const VIEWS = [
  ['PACK', 'Boîte'],
  ['EXPLODED', 'Ouverte'],
  ['DIELINE', 'À plat'],
  ['XRAY', 'Rayons X'],
  ['PRESSURE', 'Charge'],
];
const VIEW_PRESET = { PACK: 0, EXPLODED: 44, DIELINE: 100, XRAY: 0, PRESSURE: 0 };
const PHASES = ['opening', 'dieline', 'reflow', 'closing'];
const SLOTS = [
  ['LEFT_COPY', 'Gauche'],
  ['FRONT', 'Avant'],
  ['RIGHT_DATA', 'Droite'],
  ['BACK', 'Dos'],
];
const FR_SURFACE = { FRONT: 'la face avant', LEFT_COPY: 'la gauche', RIGHT_DATA: 'la droite', BACK: 'le dos' };

const reducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
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
      <span>Chargement du master Blender</span>
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
  const [order, setOrder] = useState([]); // placement order, for who gets pushed out
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
  const [drag, setDrag] = useState(null); // { kind, x, y, vx, target }
  const [resetArmed, setResetArmed] = useState(false);

  const animationToken = useRef(0);
  const decompositionRef = useRef(decomposition);
  const runningRef = useRef(false);
  const tourToken = useRef(0);
  const pickRef = useRef(null);
  const spreadRef = useRef(null);

  const brief = useMemo(() => ALL_KINDS.filter((k) => Object.prototype.hasOwnProperty.call(placements, k)), [placements]);
  const pressures = useMemo(() => buildPressure(placements, market, dims), [placements, market, dims]);
  const collisionSurfaces = useMemo(() => overloadedSurfaces(pressures), [pressures]);
  const placedCount = brief.filter((kind) => placements[kind]).length;
  const collision = collisionSurfaces.length > 0;
  const frontLoad = pressures.FRONT;
  const suggestion = useMemo(
    () => (compilePhase === 'unsolved' ? suggestDims(placements, market, dims) : null),
    [compilePhase, placements, market, dims],
  );

  // Who stands where. Placement order decides who gets shoved off the front.
  const rank = (k) => {
    const i = order.indexOf(k);
    return i < 0 ? -1 : i;
  };
  const frontKinds = brief.filter((k) => placements[k] === 'FRONT').sort((a, b) => rank(a) - rank(b));
  const ejected = collisionSurfaces.includes('FRONT') && frontKinds.length > 1 ? frontKinds[frontKinds.length - 1] : null;
  const standing = frontKinds.filter((k) => k !== ejected);
  const wings = brief.filter((k) => !placements[k]);
  const movedTo = Object.fromEntries((lastDiff?.moves || []).map((m) => [m.kind, m.to]));

  const dropTarget = drag?.target || null;
  const preview = useMemo(() => {
    if (!drag?.kind || !drag.target || drag.target === 'WINGS') return null;
    const next = buildPressure({ ...placements, [drag.kind]: drag.target }, market, dims);
    return { kind: drag.kind, surface: drag.target, from: pressures[drag.target], to: next[drag.target] };
  }, [drag?.kind, drag?.target, placements, market, dims, pressures]);

  useFlip(spreadRef, JSON.stringify(placements) + '|' + (ejected || '') + '|' + dims.width);

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

  // Eyes follow the pointer (CSS variables, no React re-render).
  useEffect(() => {
    let raf = 0;
    const onMove = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const root = document.documentElement.style;
        root.setProperty('--px', (e.clientX / window.innerWidth - 0.5).toFixed(3));
        root.setProperty('--py', (e.clientY / window.innerHeight - 0.5).toFixed(3));
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
    setTimeout(() => setToast(''), 2600);
  };

  const snapshot = () => ({ placements, dims, order });
  const commitPlacements = (next, nextOrder = order) => {
    setHistory((h) => [...h.slice(-29), snapshot()]);
    setPlacements(next);
    setOrder(nextOrder);
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
    commitPlacements({ ...placements, [kind]: surface }, [...order.filter((k) => k !== kind), kind]);
    play('crease', { intensity: 0.7 });
    setAnnouncement(`${REQUIREMENTS[kind].label} va sur ${FR_SURFACE[surface]}.`);
  };

  const unplace = (kind) => {
    if (runningRef.current || !placements[kind]) return;
    commitPlacements({ ...placements, [kind]: null }, order.filter((k) => k !== kind));
    setCompiled(false);
    setCompilePhase('idle');
  };

  const addToBrief = (kind) => {
    if (runningRef.current || kind in placements) return;
    commitPlacements({ ...placements, [kind]: null });
    setCompiled(false);
    setCompilePhase('idle');
    play('tick');
    setAnnouncement(`${REQUIREMENTS[kind].label} entre en coulisse.`);
  };

  const removeFromBrief = (kind) => {
    if (runningRef.current || REQUIREMENTS[kind].core) return;
    const next = { ...placements };
    delete next[kind];
    commitPlacements(next, order.filter((k) => k !== kind));
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
    setOrder(previous.order || []);
    setCompiled(false);
    setCompilePhase('idle');
    setLastDiff(null);
    setAnnouncement('Dernier changement annulé.');
  };

  /* ------------------------ character drag & drop ---------------------- */

  const targetAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest?.('[data-drop]');
    if (el) return el.getAttribute('data-drop');
    return pickRef.current?.(x, y) || null;
  };

  const startDrag = (kind) => (event) => {
    if (runningRef.current || event.button > 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    let lastX = startX;
    let moved = false;
    let current = null;
    const move = (e) => {
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return;
      if (!moved) {
        moved = true;
        document.body.classList.add('is-dragging');
      }
      current = { kind, x: e.clientX, y: e.clientY, vx: e.clientX - lastX, target: targetAt(e.clientX, e.clientY) };
      lastX = e.clientX;
      setDrag(current);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.classList.remove('is-dragging');
      setDrag(null);
      if (!moved) {
        setSelectedKind((c) => (c === kind ? null : kind));
        play('tick');
      } else if (current?.target === 'WINGS') unplace(kind);
      else if (current?.target) placeConstraint(kind, current.target);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const dropOn = (surface) => {
    if (!selectedKind) return;
    if (surface === 'WINGS') unplace(selectedKind);
    else placeConstraint(selectedKind, surface);
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
    setOrder((o) => [...o.filter((k) => solution.placements[k]), ...Object.keys(solution.placements).filter((k) => !o.includes(k))]);
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
      ? `L'éditeur a tranché. Forme valide pour ${MARKETS[targetMarket].label}. ${solution.moves.length} exigence(s) déplacée(s).`
      : 'Aucune mise en page ne tient sur ce carton.');
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

  const TOUR_STEPS = 7;
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
    const put = (next, nextOrder) => {
      setPlacements(next);
      setOrder(nextOrder);
      play('crease', { intensity: 0.7 });
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
      setOrder([]);
      setLastDiff(null);

      caption(1, 'Un vrai carton Blender', 'À gauche, le master Blender : charnières, pot, capuchon, notice. À droite, la face avant — cette colonne.');
      await wait(900);
      setViewMode('XRAY');
      await wait(2400);
      setViewMode('PACK');

      caption(2, 'Tout le monde veut la façade', 'Les exigences sont des personnages. Chacun réclame la face avant.');
      await wait(600);
      put({ language: 'FRONT', data: null, claim: null }, ['language']);
      await wait(800);
      put({ language: 'FRONT', data: 'FRONT', claim: null }, ['language', 'data']);
      await wait(800);
      put(IMPOSSIBLE_FRONT, ['language', 'data', 'claim']);

      caption(3, 'La colonne ne tient plus', 'La typographie se comprime, le dernier arrivé est éjecté dans la marge.');
      setViewMode('PRESSURE');
      await wait(2800);

      caption(4, 'L’éditeur tranche', 'Le carton s’ouvre, se met à plat, chaque exigence rejoint la face qui peut la porter.');
      const eu = await runCompile(IMPOSSIBLE_FRONT, 'EU', NOMINAL_DIMS, guard);
      await wait(1600);

      caption(5, 'Même master, autre marché', 'Le Canada réserve la gauche aux mentions bilingues : l’éditeur trouve une autre répartition.');
      setMarket('CANADA');
      setCompiled(false);
      await wait(900);
      const ca = await runCompile(eu.placements, 'CANADA', NOMINAL_DIMS, guard);
      await wait(1300);

      caption(6, 'Trois de plus en coulisse', 'Avertissements, allégation éco, code-barres. Cette fois, même l’éditeur cale.');
      const grown = { ...ca.placements, warning: null, eco: null, barcode: null };
      setPlacements(grown);
      await wait(1300);
      await runCompile(grown, 'CANADA', NOMINAL_DIMS, guard);
      await wait(1800);

      const bigger = suggestDims(grown, 'CANADA', NOMINAL_DIMS) || NOMINAL_DIMS;
      caption(7, `+${bigger.width - NOMINAL_DIMS.width} mm, et tout le monde tient`, `L’éditeur calcule le plus petit carton qui suffit : ${bigger.width} × ${bigger.depth} × ${bigger.height} mm.`);
      setDims(bigger);
      await wait(1500);
      await runCompile(grown, 'CANADA', bigger, guard);
      await wait(3200);
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
      setResetArmed(true);
      setTimeout(() => setResetArmed(false), 2200);
      return;
    }
    setResetArmed(false);
    animationToken.current += 1;
    setHistory((h) => [...h.slice(-29), snapshot()]);
    setPlacements(emptyPlacements());
    setOrder([]);
    setDims(NOMINAL_DIMS);
    setDecomp(0);
    setViewMode('PACK');
    setCompiled(false);
    setCompilePhase('idle');
    setSelectedKind(null);
    setReflowMoves([]);
    setLastDiff(null);
    flash('Page blanche. Z pour revenir en arrière.');
  };

  const changeMarket = (value) => {
    if (runningRef.current || value === market) return;
    setMarket(value);
    setCompiled(false);
    setCompilePhase('idle');
    setLastDiff(null);
    play('tick');
    setAnnouncement(`Édition ${MARKETS[value].label}. ${MARKETS[value].note}`);
  };

  const shareLink = async () => {
    const url = window.location.origin + window.location.pathname + '#' + encodeState({ market, brief, placements, dims, viewMode });
    try {
      await navigator.clipboard.writeText(url);
      flash('Lien copié — il rouvre exactement cette page.');
    } catch {
      window.prompt('Copier ce lien', url);
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
    flash('Dieline concept exportée · SVG · mm');
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
  const phaseIndex = PHASES.indexOf(compilePhase);
  const chapter = (() => {
    if (running && phaseIndex >= 0) return ['04', 'L’éditeur', 'Le carton s’ouvre, se met à plat et se replie. Chaque exigence marche vers la face qui peut la porter.'];
    if (compilePhase === 'unsolved') return ['04', 'L’impasse', 'Aucune répartition ne tient sur ce carton. Il faut retirer une exigence — ou agrandir le carton.'];
    if (collision) return ['03', 'La face avant', 'La colonne de droite est la face avant. Elle déborde : la typographie se comprime et le dernier arrivé est éjecté.'];
    if (compiled) return ['05', 'La forme valide', `Même master, nouvelle hiérarchie. Chacun a sa face — édition ${marketLabel}.`];
    if (placedCount === 0) return ['01', 'Le brief', 'Six exigences attendent en coulisse. Glisse-les sur le carton ou dans la colonne de droite.'];
    return ['02', 'La mise en page', 'Place les exigences. La colonne de droite est la face avant : elle a une limite.'];
  })();

  const headline = (() => {
    if (running && phaseIndex >= 0) return 'L’ÉDITEUR REDISTRIBUE';
    if (compilePhase === 'unsolved') return 'MÊME L’ÉDITEUR CALE';
    if (collision && frontLoad > 1) return 'LA FACE AVANT NE TIENT PLUS';
    if (compiled) return 'CHACUN SA FACE';
    return 'LA FACE AVANT A UNE LIMITE';
  })();
  const stretch = Math.round(125 - Math.min(1, frontLoad) * 63);
  const spill = frontLoad > 1 && !running ? (frontLoad > 1.4 ? 2 : 1) : 0;

  const noteFor = (kind) => {
    if (running) return null;
    if (kind === ejected) return ['pas de place !', 'pen'];
    if (compiled && movedTo[kind]) return [CALM[movedTo[kind]], 'blue'];
    if (!compiled && placements[kind] === 'FRONT' && kind === order[order.length - 1]) return [LOUD[kind], 'ink'];
    return null;
  };

  const renderChar = (kind, i, size = 1, state = '') => {
    const note = noteFor(kind);
    return (
      <Character
        key={kind}
        kind={kind}
        index={i}
        size={size}
        state={state}
        note={note?.[0]}
        noteTone={note?.[1]}
        selected={selectedKind === kind}
        dragging={drag?.kind === kind}
        disabled={running}
        onPointerDown={startDrag(kind)}
        onKeySelect={() => setSelectedKind((c) => (c === kind ? null : kind))}
        onRemove={!REQUIREMENTS[kind].core && !placements[kind] ? () => removeFromBrief(kind) : undefined}
      />
    );
  };

  const predicted = (surface) => (preview && preview.surface === surface ? preview.to : null);
  const nominal = isNominal(dims);
  const geometrySource = usingFallback || !nominal ? 'jumeau procédural' : 'master Blender 0.6.0';
  const pressLabel = running ? (phaseIndex >= 0 ? `${phaseIndex + 1}/4` : '…') : 'l’éditeur tranche';

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
    hoverSurface: drag?.target && drag.target !== 'WINGS' ? drag.target : null,
    preview,
    onPickerReady: (fn) => { pickRef.current = fn; },
  };

  const frontTone = frontLoad > 1 ? 'hot' : frontLoad > 0.75 ? 'warm' : 'cool';

  return (
    <main
      className={`report${selectedKind ? ' is-selecting' : ''}${drag ? ' is-dragging-char' : ''}${tour ? ' is-touring' : ''}${running ? ' is-running' : ''}`}
      ref={spreadRef}
    >
      <header className="running-head">
        <div className="masthead-title">
          <strong>PACKSHIFT</strong>
          <span>Rapport de négociation · N° 19</span>
        </div>
        <nav className="editions" aria-label="Édition (marché)">
          {Object.keys(MARKETS).map((value) => (
            <button
              key={value}
              className={market === value ? 'active' : ''}
              aria-pressed={market === value}
              disabled={running}
              onClick={() => changeMarket(value)}
              title={MARKETS[value].note}
            >
              Édition {value === 'CANADA' ? 'CA' : value}
            </button>
          ))}
        </nav>
        <nav className="tools" aria-label="Outils">
          <button onClick={tour ? skipTour : runTour} disabled={running && !tour} className="tool-tour">{tour ? 'Passer' : 'Visite guidée'}</button>
          <button onClick={shareLink} disabled={running}>Partager</button>
          <button onClick={exportDieline} disabled={running}>Dieline ⤓</button>
          <button onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? 'Son coupé' : 'Son actif'} className="tool-sound">
            <span className={'bars' + (muted ? ' off' : '')} aria-hidden="true"><i /><i /><i /></span>
          </button>
        </nav>
      </header>

      <div className="spread">
        {/* ---------------------------- LEFT PAGE ---------------------------- */}
        <section className="page page-left" aria-label="Page de gauche : le carton">
          <div className="chapter">
            <div className="chapter-no" key={chapter[0]}>{chapter[0]}</div>
            <div className="chapter-text">
              <span>CHAPITRE</span>
              <h2 key={chapter[1]}>{chapter[1]}</h2>
              <p>{chapter[2]}</p>
            </div>
          </div>

          <figure className="figure">
            <figcaption>
              <span>FIG. 1 — LE CARTON</span>
              <span>{geometrySource}</span>
            </figcaption>
            <div className={'plate' + (dropTarget && dropTarget !== 'WINGS' ? ' targeted' : '')}>
              <div className="canvas-wrap">
                <Canvas
                  shadows
                  flat
                  dpr={[1, 1.75]}
                  camera={{ position: [4.6, 2.6, 7.3], fov: 34, near: 0.1, far: 80 }}
                  gl={{ antialias: true, alpha: true }}
                  aria-label="Carton 3D. Glisse une exigence sur une de ses faces."
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
              <div className="views" role="group" aria-label="Vues">
                {VIEWS.map(([mode, label], i) => (
                  <button key={mode} className={viewMode === mode ? 'active' : ''} aria-pressed={viewMode === mode} onClick={() => setMode(mode)} disabled={running}>
                    <kbd>{i + 1}</kbd>{label}
                  </button>
                ))}
              </div>
            </div>
            <label className="scrub">
              <span>DÉPLIER</span>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(decomposition)}
                disabled={running}
                style={{ '--v': decomposition }}
                onChange={(event) => {
                  animationToken.current += 1;
                  setDecomp(Number(event.target.value));
                  if (!['XRAY', 'PRESSURE'].includes(viewMode)) setViewMode('CUSTOM');
                }}
                aria-label="Déplier le carton"
              />
              <output>{Math.round(decomposition)}%</output>
            </label>
          </figure>

          <div className="faces">
            <div className="faces-head"><span>FIG. 2 — OÙ VIT CHAQUE EXIGENCE</span><span>charge / capacité</span></div>
            <div className="slots">
              {SLOTS.map(([surface, label]) => {
                const load = pressures[surface];
                const p = predicted(surface);
                const who = brief.filter((k) => placements[k] === surface);
                const over = load > 1;
                return (
                  <div
                    key={surface}
                    className={'slot' + (over ? ' over' : '') + (dropTarget === surface ? ' drop' : '') + (selectedKind ? ' pickable' : '')}
                    data-drop={surface}
                    onClick={() => dropOn(surface)}
                  >
                    <div className="slot-head">
                      <b>{label}</b>
                      <em className={p !== null && p > 1 ? 'hot' : ''}>{Math.round((p ?? load) * 100)}%</em>
                    </div>
                    <i className="slot-bar"><b style={{ width: Math.min(100, load * 100) + '%' }} />{p !== null && <u style={{ width: Math.min(100, p * 100) + '%' }} />}</i>
                    <div className="slot-cast">
                      {surface === 'FRONT'
                        ? <span className="slot-pointer">→ la colonne de droite{who.length ? ` · ${who.length}` : ''}</span>
                        : who.map((k, i) => renderChar(k, i, 0.55, 'mini'))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="stock">
            <span>CARTON</span>
            {['width', 'depth', 'height'].map((key) => (
              <label key={key}>
                <em>{{ width: 'L', depth: 'P', height: 'H' }[key]}</em>
                <input
                  type="range"
                  min={DIM_LIMITS[key][0]}
                  max={DIM_LIMITS[key][1]}
                  value={dims[key]}
                  disabled={running}
                  onChange={(e) => changeDims({ ...dims, [key]: Number(e.target.value) })}
                  aria-label={`Carton ${key} en millimètres`}
                />
                <output>{dims[key]}</output>
              </label>
            ))}
            <span className="dim">mm</span>
          </div>
        </section>

        {/* ---------------------------- RIGHT PAGE --------------------------- */}
        <section className={'page page-right tone-' + frontTone} aria-label="Page de droite : la face avant">
          <div className="page-head">
            <span>FACE AVANT = CETTE COLONNE · {dims.width} MM</span>
            <span className={'front-load ' + frontTone}>{Math.round((predicted('FRONT') ?? frontLoad) * 100)}%</span>
          </div>

          <div
            className={'column' + (dropTarget === 'FRONT' ? ' drop' : '') + (selectedKind ? ' pickable' : '')}
            data-drop="FRONT"
            onClick={() => dropOn('FRONT')}
          >
            <ColumnHeadline text={headline} stretch={stretch} spill={spill} tone={frontLoad > 1 && !running ? 'hot' : 'ink'} />
            <div className="stage">
              <div className="baseline" />
              <div className="standing">
                {standing.map((k, i) => renderChar(k, i, 1, frontLoad > 1 ? 'squeezed' : ''))}
              </div>
              {compiled && standing.length > 0 && !running && <span className="pen-circle" aria-hidden="true" />}
            </div>
            <div className="edge" aria-hidden="true"><span>BORD DE FACE</span></div>
            <div className="margin-drop">
              {ejected && renderChar(ejected, 0, 1, 'ejected')}
            </div>
          </div>

          <div className="editor-line" aria-live="polite">
            {compiled && !running && <p className="pen-note">ok — chacun sa face. {lastDiff?.moves?.length ? `${lastDiff.moves.length} déplacé${lastDiff.moves.length > 1 ? 's' : ''}.` : ''} ✓</p>}
            {compilePhase === 'unsolved' && !running && (
              <p className="pen-note">
                même moi, je cale.
                {suggestion
                  ? <button onClick={() => changeDims(suggestion)}>→ carton {suggestion.width} × {suggestion.depth} × {suggestion.height} mm ?</button>
                  : <em> retire une exigence.</em>}
              </p>
            )}
            {collision && !running && compilePhase !== 'unsolved' && <p className="pen-note">{collisionSurfaces.map((s) => FR_SURFACE[s]).join(' + ')} : {Math.round(Math.max(...collisionSurfaces.map((s) => pressures[s])) * 100)} % — trop plein.</p>}
          </div>

          <div className="actions">
            <button className="ghost" onClick={undo} disabled={running || history.length === 0} title="Annuler (Z)">Annuler</button>
            <button className={'ghost' + (resetArmed ? ' armed' : '')} onClick={resetStudio} disabled={running} title="Recommencer (R)">{resetArmed ? 'Sûr ?' : 'Recommencer'}</button>
            <button
              className={'pen-button' + (collision ? ' urgent' : '') + (running ? ' running' : '')}
              onClick={compileSurface}
              disabled={running || brief.length === 0}
              style={{ '--phase': phaseIndex < 0 ? 0 : (phaseIndex + 1) / PHASES.length }}
              title="Compiler (C)"
            >
              <span>{pressLabel}</span>
            </button>
          </div>

          <div
            className={'wings' + (dropTarget === 'WINGS' ? ' drop' : '') + (selectedKind ? ' pickable' : '')}
            data-drop="WINGS"
            onClick={() => dropOn('WINGS')}
          >
            <div className="wings-head">
              <span>EN COULISSE</span>
              <span className="add">
                {ALL_KINDS.filter((k) => !brief.includes(k)).map((kind) => (
                  <button key={kind} onClick={(e) => { e.stopPropagation(); addToBrief(kind); }} disabled={running} style={{ '--ink': CAST[kind].color }}>
                    + {REQUIREMENTS[kind].label}
                  </button>
                ))}
              </span>
            </div>
            <div className="wings-cast">
              {wings.length ? wings.map((k, i) => renderChar(k, i, 0.8)) : <span className="empty">personne — tout le monde est sur le carton</span>}
            </div>
          </div>
        </section>
      </div>

      <footer className="running-foot">
        <nav aria-label="Chapitres">
          {[['01', 'Le brief'], ['02', 'La mise en page'], ['03', 'La face avant'], ['04', 'L’éditeur'], ['05', 'La forme valide']].map(([n, t]) => (
            <span key={n} className={chapter[0] === n ? 'on' : ''}><b>{n}</b> {t}</span>
          ))}
        </nav>
        <span className="truth">Concept · capacités de démonstration · ni réglementaire ni fabrication</span>
      </footer>

      {tour && (
        <aside className="tour" role="status" aria-live="polite">
          <span>NOTE DE L’ÉDITEUR · {tour.step} / {tour.total}</span>
          <b key={tour.title}>{tour.title}</b>
          <p key={tour.body}>{tour.body}</p>
          <button onClick={skipTour}>passer · échap</button>
        </aside>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
      <div className="sr-only" aria-live="assertive">{announcement}</div>

      {drag && (
        <div className="drag-ghost" style={{ transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -60%) rotate(${Math.max(-18, Math.min(18, drag.vx))}deg)` }} aria-hidden="true">
          <span className="char-body" style={{ width: CAST[drag.kind].w, height: CAST[drag.kind].h, background: CAST[drag.kind].color }} data-shape={CAST[drag.kind].shape}>
            <span className="eyes"><i><b /></i><i><b /></i></span>
          </span>
          <small>{drag.target === 'WINGS' ? 'en coulisse' : drag.target ? `→ ${FR_SURFACE[drag.target]}` : REQUIREMENTS[drag.kind].label}</small>
        </div>
      )}
    </main>
  );
}
