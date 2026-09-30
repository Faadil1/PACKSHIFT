import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MARKETS,
  REQUIREMENTS,
  buildPressure,
  capacityFor,
  overloadedSurfaces,
  ruleViolations,
  solvePlacements,
} from '../model/pressure.js';
import { isMuted, play, setMuted, unlockAudio } from '../audio/sound.js';
import { CAST, Character, useFlip } from '../ui/Character.jsx';
import {
  ALREADY,
  FACE,
  FACE_ORDER,
  LEVELS,
  MARKET_PLAIN,
  NAME_MAX,
  PLAIN,
  SANDBOX,
  SIZE_MAX,
  SIZE_MIN,
  SLOGAN_MAX,
  brandOpts,
  cm,
  dailyLevel,
  decodeGameHash,
  encodeGameHash,
  formatTime,
  levelById,
  minimalStep,
  sizeDims,
  solved,
  starsFor,
  todayKey,
} from './levels.js';
import { renderShareCard, shareText } from './shareCard.js';

const GameScene = lazy(() => import('./GameScene.jsx'));
const preloadScene = () => import('./GameScene.jsx');

const OPEN_LID = 0.13; // the carton waits with its lid open, and shuts on a win
const PROGRESS_KEY = 'packshift.progress.v1';

const readProgress = () => {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
  } catch {
    return {};
  }
};
const writeProgress = (value) => {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(value));
  } catch {
    /* private mode: progress simply isn't kept */
  }
};

const reducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const fromLink = (() => {
  if (typeof window === 'undefined') return null;
  try {
    return decodeGameHash(window.location.hash);
  } catch {
    return null;
  }
})();

const emptyFor = (level) => Object.fromEntries(level.kinds.map((k) => [k, null]));

export default function Game({ onPro }) {
  const [screen, setScreen] = useState(fromLink ? 'play' : 'intro');
  const [level, setLevel] = useState(fromLink?.level || LEVELS[0]);
  const [brand, setBrand] = useState(fromLink?.brand || { name: 'Ma crème', slogan: 'Hydrate 24h' });
  const [rival, setRival] = useState(fromLink?.rival || null);
  const [placements, setPlacements] = useState(() => emptyFor(fromLink?.level || LEVELS[0]));
  const [order, setOrder] = useState([]);
  const [step, setStep] = useState(fromLink?.level?.step || 0);
  const [moves, setMoves] = useState(0);
  const [startAt, setStartAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [hints, setHints] = useState(0);
  const [hint, setHint] = useState(null);
  const [won, setWon] = useState(null);
  const [selectedKind, setSelectedKind] = useState(null);
  const [drag, setDrag] = useState(null);
  const [lid, setLid] = useState(OPEN_LID);
  const [progress, setProgress] = useState(readProgress);
  const [toast, setToast] = useState('');
  const [muted, setMutedState] = useState(isMuted);
  const [snapshotReady, setSnapshotReady] = useState(false);

  const boardRef = useRef(null);
  const sceneWrap = useRef(null);
  const pickRef = useRef(null);
  const lidAnim = useRef(0);

  const isSandbox = level.id === 'boite';
  const opts = isSandbox ? brandOpts(brand, level.market) : undefined;
  const dims = sizeDims(step);
  const pressures = useMemo(() => buildPressure(placements, level.market, dims, opts), [placements, level.market, dims.width, dims.depth, dims.height, opts?.weights?.claim]); // eslint-disable-line react-hooks/exhaustive-deps
  const overloaded = useMemo(() => overloadedSurfaces(pressures), [pressures]);
  const violations = useMemo(() => ruleViolations(placements, level.market), [placements, level.market]);
  const unplaced = level.kinds.filter((k) => !placements[k]);
  const allPlaced = unplaced.length === 0;
  const fits = allPlaced && overloaded.length === 0 && violations.length === 0;
  const best = useMemo(() => minimalStep(level.kinds, level.market, opts), [level, opts?.weights?.claim]); // eslint-disable-line react-hooks/exhaustive-deps
  const capacity = useMemo(() => capacityFor(level.market, dims), [level.market, dims.width, dims.depth, dims.height]); // eslint-disable-line react-hooks/exhaustive-deps
  const weight = { ...MARKETS[level.market].weight, ...(opts?.weights || {}) };

  useFlip(boardRef, JSON.stringify(placements) + screen);

  /* ---------------------------- effects ----------------------------- */

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Warm the 3D chunk while the intro is being read.
  useEffect(() => {
    if (screen !== 'intro') return undefined;
    const id = setTimeout(preloadScene, 1200);
    return () => clearTimeout(id);
  }, [screen]);

  useEffect(() => {
    if (!startAt || won) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [startAt, won]);

  const wasOver = useRef(false);
  useEffect(() => {
    const over = overloaded.length > 0;
    if (over && !wasOver.current) play('collide');
    wasOver.current = over;
  }, [overloaded.length]);

  // Keep the URL pointing at the current puzzle (so a copied address works).
  useEffect(() => {
    if (screen !== 'play') return;
    const hash = '#' + encodeGameHash({ level, brand: isSandbox ? brand : null, result: null });
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [screen, level, brand, isSandbox]);

  // Placement levels win by themselves the moment everything fits.
  useEffect(() => {
    if (won || level.sizing || !fits) return undefined;
    const id = setTimeout(() => finish(), 420);
    return () => clearTimeout(id);
  }, [fits, won, level.sizing]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------------------- helpers ----------------------------- */

  const flash = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 2600);
  };

  const animateLid = useCallback((target, duration = 900) => {
    const token = ++lidAnim.current;
    if (reducedMotion()) {
      setLid(target);
      return;
    }
    let from = null;
    const start = performance.now();
    const tick = (t) => {
      if (token !== lidAnim.current) return;
      setLid((current) => {
        if (from === null) from = current;
        const k = Math.min(1, (t - start) / duration);
        const e = 1 - Math.pow(1 - k, 3);
        return from + (target - from) * e;
      });
      if (t - start < duration) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  const startLevel = (next, { keepRival = false, nextBrand } = {}) => {
    setLevel(next);
    setPlacements(emptyFor(next));
    setOrder([]);
    setStep(next.step || 0);
    setMoves(0);
    setStartAt(null);
    setHints(0);
    setHint(null);
    setWon(null);
    setSelectedKind(null);
    setSnapshotReady(false);
    if (!keepRival) setRival(null);
    if (nextBrand) setBrand(nextBrand);
    lidAnim.current += 1;
    setLid(OPEN_LID);
    setScreen('play');
    play('tick');
  };

  const countMove = () => {
    setMoves((m) => m + 1);
    if (!startAt) setStartAt(Date.now());
  };

  const place = (kind, surface) => {
    if (won || placements[kind] === surface) return;
    setSelectedKind(null);
    setHint(null);
    setPlacements((p) => ({ ...p, [kind]: surface }));
    setOrder((o) => [...o.filter((k) => k !== kind), kind]);
    countMove();
    play('crease', { intensity: 0.7 });
  };

  const unplace = (kind) => {
    if (won || !placements[kind]) return;
    setPlacements((p) => ({ ...p, [kind]: null }));
    setOrder((o) => o.filter((k) => k !== kind));
    countMove();
    play('tick');
  };

  const resize = (value) => {
    if (won) return;
    setHint(null);
    setStep(value);
    if (!startAt) setStartAt(Date.now());
  };

  const finish = () => {
    const ms = startAt ? Date.now() - startAt : 0;
    const stars = isSandbox ? 0 : starsFor(level, { moves, step, hints }, opts);
    const result = { moves, ms, step, stars, width: dims.width };
    setWon(result);
    setSelectedKind(null);
    play('resolve');
    animateLid(0, 1100);
    setTimeout(() => setSnapshotReady(true), 1250);
    if (!isSandbox) {
      const key = level.id === 'daily' ? 'daily-' + level.key : String(level.id);
      const prev = progress[key];
      if (!prev || stars > prev.stars || (stars === prev.stars && moves < prev.moves)) {
        const next = { ...progress, [key]: { stars, moves, ms, step } };
        setProgress(next);
        writeProgress(next);
      }
    }
  };

  const giveHint = () => {
    if (won) return;
    const solution = solvePlacements(placements, level.market, dims, opts);
    if (!solution.valid) {
      setHint({ impossible: true });
      flash(level.sizing ? 'Aucun rangement ne marche à cette taille. Change la taille de la boîte.' : 'Même la meilleure solution déborde ici.');
      setHints((h) => h + 1);
      return;
    }
    const kind = level.kinds.find((k) => solution.placements[k] !== placements[k]);
    if (!kind) return;
    setHint({ kind, surface: solution.placements[kind] });
    setSelectedKind(kind);
    setHints((h) => h + 1);
    play('tick');
  };

  const reset = () => startLevel(level, { keepRival: true });

  const toggleSound = () => {
    unlockAudio();
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) play('tick');
  };

  /* ----------------------------- drag ------------------------------- */

  const targetAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest?.('[data-drop]');
    if (el) return el.getAttribute('data-drop');
    return pickRef.current?.(x, y) || null;
  };

  const startDrag = (kind) => (event) => {
    if (won || event.button > 0) return;
    event.preventDefault();
    const sx = event.clientX;
    const sy = event.clientY;
    let lastX = sx;
    let moved = false;
    let current = null;
    const move = (e) => {
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return;
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
      } else if (current?.target === 'TRAY') unplace(kind);
      else if (current?.target) place(kind, current.target);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const tapTarget = (surface) => {
    if (!selectedKind) return;
    if (surface === 'TRAY') unplace(selectedKind);
    else place(selectedKind, surface);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setSelectedKind(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ----------------------------- share ------------------------------ */

  const shareUrl = (withResult) => window.location.origin + window.location.pathname + '#'
    + encodeGameHash({ level, brand: isSandbox ? brand : null, result: withResult && won ? won : null });

  const verdictFor = () => {
    if (isSandbox) {
      if (won) return `« ${brand.name || 'Mon produit'} » rentre !`;
      if (best === null) return 'Mon slogan ne rentre nulle part';
      return 'Ça ne rentre pas… encore';
    }
    return won ? `Rangé en ${won.moves} coup${won.moves > 1 ? 's' : ''}` : 'Pas encore';
  };

  const detailFor = () => {
    const n = level.kinds.length;
    const size = `boîte de ${cm(dims.width)}`;
    if (isSandbox) return `« ${brand.slogan} » · ${brand.slogan.length} caractères · ${size}`;
    return `${n} mentions obligatoires · ${size}${won ? ' · ' + formatTime(won.ms) : ''}`;
  };

  const kickerFor = () => (level.id === 'daily' ? level.title : isSandbox ? 'Ta boîte' : `Niveau ${level.id} · ${level.title}`);

  const share = async () => {
    unlockAudio();
    const url = shareUrl(true);
    const text = shareText({
      title: level.id === 'daily' ? level.title : isSandbox ? `« ${brand.name} »` : `Niveau ${level.id}`,
      fits: Boolean(won) || fits,
      stars: won?.stars || 0,
      detail: won ? `${won.moves} coups · ${cm(dims.width)}` : `${cm(dims.width)}`,
      pressures,
      url,
    });
    // Copy first, while the click still counts as a user gesture (Safari drops
    // clipboard access after the await below).
    const phone = window.matchMedia?.('(pointer: coarse)').matches;
    let copied = false;
    if (!phone) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }
    let blob = null;
    try {
      blob = await renderShareCard({
        snapshot: sceneWrap.current?.querySelector('canvas') || null,
        kicker: kickerFor(),
        verdict: verdictFor(),
        detail: detailFor(),
        stars: won?.stars || 0,
        pressures,
        fits: Boolean(won) || fits,
        host: window.location.host,
      });
    } catch (error) {
      console.warn('PACKSHIFT: share card failed', error);
    }
    const file = blob ? new File([blob], 'est-ce-que-ca-rentre.png', { type: 'image/png' }) : null;
    // Phones: the native share sheet (image + text straight into WhatsApp,
    // Instagram, Messages…). Desktop: download the card and copy the text.
    if (phone && navigator.share) {
      try {
        if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, title: 'Est-ce que ça rentre ?' });
        else await navigator.share({ text, url, title: 'Est-ce que ça rentre ?' });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    // Desktop: download the card and copy the text + link.
    if (blob) {
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = 'est-ce-que-ca-rentre.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1500);
    }
    if (copied) flash(blob ? 'Image téléchargée · texte et lien copiés' : 'Texte et lien copiés');
    else if (blob) flash('Image téléchargée');
    else window.prompt('Copie ce texte', text);
  };

  const copyChallenge = async () => {
    const url = shareUrl(true);
    try {
      await navigator.clipboard.writeText(url);
      flash('Lien du défi copié. Envoie-le à quelqu’un !');
    } catch {
      window.prompt('Copie ce lien', url);
    }
  };

  /* ------------------------------ copy ------------------------------ */

  const status = (() => {
    if (won) return { tone: 'win', text: 'Ça rentre !' };
    if (hint?.impossible) return { tone: 'hot', text: level.sizing === 'shrink' ? 'Trop petit : rien ne marche à cette taille.' : 'Aucun rangement ne marche à cette taille. Agrandis la boîte ↓' };
    const v = violations[0];
    if (v?.kind === 'claim') return { tone: 'hot', text: 'Le slogan doit être devant, sinon personne ne le voit.' };
    if (v?.kind === 'barcode') return { tone: 'hot', text: 'Pas de code-barres devant : ça gâche la vitrine.' };
    if (overloaded.length) {
      const f = overloaded.map((s) => FACE[s]).join(' + ');
      if (level.sizing === 'grow' && allPlaced && moves >= 6) return { tone: 'hot', text: `${f} déborde encore… et si la boîte était plus grande ?` };
      if (isSandbox && placements.claim === 'FRONT' && overloaded.includes('FRONT')) return { tone: 'hot', text: best === null ? 'Ton slogan est trop long pour n’importe quelle boîte. Raccourcis-le !' : `Ton slogan prend trop de place devant. Raccourcis-le, ou agrandis la boîte.` };
      return { tone: 'hot', text: `Ça déborde : ${f} !` };
    }
    if (!allPlaced) return { tone: 'ink', text: unplaced.length === level.kinds.length ? 'Glisse une étiquette sur une face (ou touche-la, puis touche une face).' : `Encore ${unplaced.length} étiquette${unplaced.length > 1 ? 's' : ''} à coller.` };
    if (level.sizing === 'shrink') return { tone: 'ok', text: step > (best ?? step) ? 'Ça rentre. Peux-tu rétrécir encore ?' : 'Ça rentre. C’est ta taille finale ?' };
    if (level.sizing === 'grow') return { tone: 'ok', text: step > (best ?? step) ? 'Ça rentre ! Mais une boîte plus petite marcherait-elle ?' : 'Ça rentre ! C’est ta taille finale ?' };
    if (isSandbox) return { tone: 'ok', text: 'Ça rentre ! Valide ta boîte.' };
    return { tone: 'ok', text: 'Ça rentre !' };
  })();

  const noteFor = (kind) => {
    if (won) return null;
    if (level.id === 1 && moves === 0 && kind === 'claim') return ['glisse-moi devant ↗', 'ink'];
    if (hint?.kind === kind) return [`→ ${FACE[hint.surface]}`, 'blue'];
    const surface = placements[kind];
    if (!surface) return null;
    if (violations.some((v) => v.kind === kind)) return [kind === 'claim' ? 'on ne me voit pas !' : 'pas ici !', 'pen'];
    if (overloaded.includes(surface)) {
      const onFace = order.filter((k) => placements[k] === surface);
      if (onFace[onFace.length - 1] === kind) return ['je rentre pas !', 'pen'];
    }
    return null;
  };

  const renderChar = (kind, i, size, state = '') => {
    const note = noteFor(kind);
    return (
      <Character
        key={kind}
        kind={kind}
        index={i}
        size={size}
        state={state}
        label={PLAIN[kind].name}
        note={note?.[0]}
        noteTone={note?.[1]}
        selected={selectedKind === kind}
        dragging={drag?.kind === kind}
        disabled={Boolean(won)}
        onPointerDown={startDrag(kind)}
        onKeySelect={() => setSelectedKind((c) => (c === kind ? null : kind))}
      />
    );
  };

  const preview = useMemo(() => {
    if (!drag?.kind || !drag.target || drag.target === 'TRAY') return null;
    const next = buildPressure({ ...placements, [drag.kind]: drag.target }, level.market, dims, opts);
    return { kind: drag.kind, surface: drag.target, from: pressures[drag.target], to: next[drag.target] };
  }, [drag?.kind, drag?.target, placements, pressures]); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = won ? won.ms : startAt ? now - startAt : 0;
  const sceneProps = {
    dims,
    market: level.market,
    viewMode: 'GAME',
    decomposition: lid,
    placements,
    brief: level.kinds,
    pressures,
    collisionSurfaces: overloaded,
    compiled: Boolean(won),
    compilePhase: 'idle',
    reflowMoves: [],
    interactionLocked: Boolean(drag) || Boolean(won),
    onPlaceConstraint: place,
    selectedKind,
    hoverSurface: drag?.target && drag.target !== 'TRAY' ? drag.target : null,
    preview,
    onPickerReady: (fn) => { pickRef.current = fn; },
    brand: isSandbox ? { name: brand.name, slogan: brand.slogan } : null,
  };

  const levelKey = (l) => (l.id === 'daily' ? 'daily-' + l.key : String(l.id));
  const daily = useMemo(() => dailyLevel(todayKey()), []);
  const nextLevel = typeof level.id === 'number' ? levelById(level.id + 1) : null;
  const beatRival = won && rival ? (level.sizing ? won.step < rival.step || (won.step === rival.step && won.moves < rival.moves) : won.moves < rival.moves || (won.moves === rival.moves && won.ms / 1000 < rival.seconds)) : null;

  /* ------------------------------ intro ----------------------------- */

  if (screen === 'intro') {
    return (
      <main className="game intro">
        <header className="g-top">
          <strong className="g-logo">PACKSHIFT</strong>
          <button className="g-link" onClick={onPro}>Mode pro →</button>
        </header>
        <section className="hook">
          <p className="hook-1">Tout ce qui est écrit sur une boîte est <mark>obligatoire.</mark></p>
          <p className="hook-2">Ou presque.</p>
          <p className="hook-3">Et il n’y a <em>pas la place.</em></p>
          <div className="hook-box" aria-hidden="true">
            <div className="hook-carton"><span>5,6 cm</span></div>
            {Object.keys(CAST).map((kind, i) => (
              <span key={kind} className={`hook-pop char-${CAST[kind].shape}`} style={{ '--i': i, background: CAST[kind].color }}>
                <span className="eyes"><i><b /></i><i><b /></i></span>
              </span>
            ))}
          </div>
          <h1 className="hook-q">Est-ce que ça rentre ?</h1>
          <button className="g-cta" onClick={() => startLevel(LEVELS[0])} onPointerEnter={preloadScene}>
            Jouer <small>5 niveaux · 2 minutes</small>
          </button>
          <div className="hook-more">
            <button onClick={() => startLevel(daily)}>Défi du jour <small>{daily.title.replace('Défi du ', '')}</small></button>
            <button onClick={() => startLevel(SANDBOX)}>Crée ta boîte <small>ton slogan rentre ?</small></button>
          </div>
        </section>
        <footer className="g-foot">Règles simplifiées pour le jeu · pas un avis réglementaire</footer>
      </main>
    );
  }

  /* ------------------------------ play ------------------------------ */

  return (
    <main className={`game play${selectedKind ? ' is-selecting' : ''}${drag ? ' is-dragging-char' : ''}${won ? ' is-won' : ''}`} ref={boardRef}>
      <header className="g-top">
        <button className="g-back" onClick={() => { setScreen('intro'); window.history.replaceState(null, '', window.location.pathname); }} aria-label="Retour à l’accueil">←</button>
        <nav className="g-levels" aria-label="Niveaux">
          {LEVELS.map((l) => (
            <button key={l.id} className={(level.id === l.id ? 'on ' : '') + (progress[levelKey(l)] ? 'done' : '')} onClick={() => startLevel(l)} aria-label={`Niveau ${l.id} : ${l.title}`}>
              {l.id}
              {progress[levelKey(l)] && <i>{'★'.repeat(progress[levelKey(l)].stars)}</i>}
            </button>
          ))}
          <button className={level.id === 'daily' ? 'on' : ''} onClick={() => startLevel(daily)}>Jour</button>
          <button className={isSandbox ? 'on' : ''} onClick={() => startLevel(SANDBOX)}>Ta boîte</button>
        </nav>
        <div className="g-meter" aria-live="off">
          <span><b>{moves}</b> coup{moves > 1 ? 's' : ''}</span>
          <span><b>{formatTime(elapsed)}</b></span>
          <button onClick={toggleSound} className="g-sound" aria-pressed={!muted} aria-label={muted ? 'Son coupé' : 'Son actif'}>{muted ? '♪̸' : '♪'}</button>
        </div>
      </header>

      <section className="g-mission">
        <p className="g-kicker">{level.id === 'daily' ? level.title : isSandbox ? 'Ta boîte' : `Niveau ${level.id} / ${LEVELS.length}`} · {MARKET_PLAIN[level.market]}</p>
        <h1>{isSandbox ? 'Ta boîte' : level.title}</h1>
        <p className="g-goal">{level.goal}</p>
        <ul className="g-rules">
          {level.rules.map((r) => <li key={r}>{r}</li>)}
        </ul>
        {rival && !won && (
          <p className="g-rival">Ton ami·e a réussi en <b>{rival.moves} coups</b>{level.sizing ? <> avec une boîte de <b>{cm(sizeDims(rival.step).width)}</b></> : <> et <b>{formatTime(rival.seconds * 1000)}</b></>}. À toi.</p>
        )}
      </section>

      {isSandbox && (
        <section className="g-brand">
          <label>
            <span>Nom du produit</span>
            <input value={brand.name} maxLength={NAME_MAX} disabled={Boolean(won)} onChange={(e) => setBrand((b) => ({ ...b, name: e.target.value }))} />
          </label>
          <label className="g-slogan">
            <span>Ton slogan <em className={brand.slogan.length > 22 ? 'hot' : ''}>{brand.slogan.length} / {SLOGAN_MAX}</em></span>
            <input value={brand.slogan} maxLength={SLOGAN_MAX} disabled={Boolean(won)} onChange={(e) => setBrand((b) => ({ ...b, slogan: e.target.value }))} placeholder="Ex. : Doux comme un nuage" />
          </label>
        </section>
      )}

      <div className="g-board">
        <div className={'g-stage' + (drag?.target && drag.target !== 'TRAY' ? ' targeted' : '')} ref={sceneWrap}>
          <Suspense fallback={<div className="g-loading">La boîte arrive…</div>}>
            <GameScene {...sceneProps} />
          </Suspense>
          <p className={'g-status tone-' + status.tone} role="status" aria-live="polite" key={status.text}>{status.text}</p>
        </div>

        <div className="g-side">
          <p className="g-faces-head"><b>Les 4 faces de la boîte</b> · la jauge = la place déjà prise</p>
          <div className="g-faces">
            {FACE_ORDER.map((surface) => {
              const load = pressures[surface];
              const p = preview?.surface === surface ? preview.to : null;
              const who = level.kinds.filter((k) => placements[k] === surface);
              const over = load > 1;
              const cap = capacity[surface];
              const base = MARKETS[level.market].base[surface] / cap;
              let acc = base;
              const bad = violations.some((v) => v.surface === surface);
              return (
                <div
                  key={surface}
                  className={'g-face' + (over ? ' over' : '') + (bad ? ' bad' : '') + (drag?.target === surface ? ' drop' : '') + (selectedKind ? ' pickable' : '') + (hint?.surface === surface ? ' hinted' : '')}
                  data-drop={surface}
                  onClick={() => tapTarget(surface)}
                >
                  <div className="g-face-head">
                    <b>{FACE[surface]}</b>
                    <em className={(p ?? load) > 1 ? 'hot' : ''}>{Math.round((p ?? load) * 100)}%</em>
                  </div>
                  <div className="g-gauge" aria-hidden="true">
                    <span className="g-seg base" style={{ bottom: 0, height: Math.min(100, base * 100) + '%' }} title={ALREADY[level.market][surface]} />
                    {who.map((k) => {
                      const h = (weight[k] / cap) * 100;
                      const el = <span key={k} className="g-seg" style={{ bottom: acc * 100 + '%', height: h + '%', background: CAST[k].color }} />;
                      acc += weight[k] / cap;
                      return el;
                    })}
                    {p !== null && p > load && <span className="g-seg ghost" style={{ bottom: load * 100 + '%', height: (p - load) * 100 + '%' }} />}
                    <i className="g-line" />
                  </div>
                  <div className="g-face-cast">
                    {who.map((k, i) => renderChar(k, i, 0.5, 'mini' + (over ? ' squeezed' : '')))}
                  </div>
                  <small className="g-already">déjà imprimé : {ALREADY[level.market][surface]}</small>
                </div>
              );
            })}
          </div>

          <div
            className={'g-tray' + (drag?.target === 'TRAY' ? ' drop' : '') + (selectedKind && placements[selectedKind] ? ' pickable' : '')}
            data-drop="TRAY"
            onClick={() => tapTarget('TRAY')}
          >
            <div className="g-tray-head">
              <span>{unplaced.length ? `À coller (${unplaced.length})` : 'Tout est collé'}</span>
              {!won && <button onClick={(e) => { e.stopPropagation(); giveHint(); }}>Indice {hints ? `(${hints})` : ''}</button>}
            </div>
            <div className="g-tray-cast">
              {unplaced.map((k, i) => renderChar(k, i, 0.78))}
            </div>
            {selectedKind && (
              <p className="g-why"><b>{PLAIN[selectedKind].name}</b> — {PLAIN[selectedKind].why} <span>Touche une face pour la coller.</span></p>
            )}
          </div>

          {level.sizing && (
            <div className="g-size">
              <label>
                <span>Taille de la boîte</span>
                <input
                  type="range"
                  min={SIZE_MIN}
                  max={SIZE_MAX}
                  value={step}
                  disabled={Boolean(won)}
                  onChange={(e) => resize(Number(e.target.value))}
                  aria-label="Taille de la boîte"
                  style={{ '--v': ((step - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)) * 100 }}
                />
                <output>{cm(dims.width)} <small>× {cm(dims.height)}</small></output>
              </label>
              {!won && <button className="g-cta small" disabled={!fits} onClick={finish}>{isSandbox ? 'Valider ma boîte' : 'C’est ma taille finale'}</button>}
            </div>
          )}

          <div className="g-actions">
            <button onClick={reset} disabled={moves === 0 && step === (level.step || 0)}>Recommencer</button>
            {won?.hidden
              ? <button className="g-cta small" onClick={() => setWon((w) => ({ ...w, hidden: false }))}>Mon score</button>
              : <button onClick={share}>Partager</button>}
          </div>
        </div>
      </div>

      {won && !won.hidden && (
        <aside className="g-win" role="dialog" aria-label="Gagné">
          <div className="g-burst" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => {
              const kind = Object.keys(CAST)[i % 6];
              return <span key={i} className={`char-${CAST[kind].shape}`} style={{ '--i': i, background: CAST[kind].color }} />;
            })}
          </div>
          <p className="g-kicker">{kickerFor()}</p>
          <h2>{isSandbox ? `« ${brand.name || 'Ton produit'} » rentre !` : 'Ça rentre !'}</h2>
          {!isSandbox && <p className="g-stars" aria-label={`${won.stars} étoiles sur 3`}>{'★'.repeat(won.stars)}<span>{'★'.repeat(3 - won.stars)}</span></p>}
          <p className="g-score">
            {won.moves} coup{won.moves > 1 ? 's' : ''} · {formatTime(won.ms)} · boîte de {cm(won.width)}
            {level.sizing && best !== null && won.step > best && <><br /><em>Le record possible : {cm(sizeDims(best).width)}</em></>}
          </p>
          {beatRival !== null && <p className="g-vs">{beatRival ? 'Tu bats ton ami·e. Renvoie-lui le défi !' : 'Ton ami·e reste devant… cette fois.'}</p>}
          <p className="g-fact">{level.fact}</p>
          <div className="g-win-actions">
            <button className="g-cta" onClick={share} disabled={!snapshotReady}>{snapshotReady ? 'Partager mon score' : '…'}</button>
            <button onClick={copyChallenge}>Défier quelqu’un</button>
            {nextLevel && <button onClick={() => startLevel(nextLevel)}>Niveau suivant →</button>}
            {!nextLevel && level.id === LEVELS.length && <button onClick={() => startLevel(daily)}>Défi du jour →</button>}
            {(level.id === 'daily' || isSandbox) && <button onClick={() => startLevel(isSandbox ? daily : SANDBOX)}>{isSandbox ? 'Défi du jour →' : 'Crée ta boîte →'}</button>}
            <button className="g-link" onClick={() => setWon((w) => ({ ...w, hidden: true }))}>voir la boîte</button>
          </div>
        </aside>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}

      {drag && (
        <div className="drag-ghost" style={{ transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -60%) rotate(${Math.max(-18, Math.min(18, drag.vx))}deg)` }} aria-hidden="true">
          <span className="char-body" style={{ width: CAST[drag.kind].w, height: CAST[drag.kind].h, background: CAST[drag.kind].color }} data-shape={CAST[drag.kind].shape}>
            <span className="eyes"><i><b /></i><i><b /></i></span>
          </span>
          <small>
            {drag.target === 'TRAY' ? 'décoller' : drag.target ? `→ ${FACE[drag.target]}${preview ? ` · ${Math.round(preview.to * 100)}%` : ''}` : PLAIN[drag.kind].name}
          </small>
        </div>
      )}
    </main>
  );
}

// Plain-language label for the requirement meta used elsewhere.
export const plainLabel = (kind) => PLAIN[kind]?.name || REQUIREMENTS[kind]?.label;
