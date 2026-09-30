import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MARKETS,
  buildPressure,
  capacityFor,
  overloadedSurfaces,
  ruleViolations,
  solvePlacements,
} from '../model/pressure.js';
import { isMuted, play, setMuted, unlockAudio } from '../audio/sound.js';
import { CAST, Character, useFlip } from '../ui/Character.jsx';
import {
  FACE_ORDER,
  LEVELS,
  NAME_MAX,
  SANDBOX,
  SIZE_MAX,
  SIZE_MIN,
  SLOGAN_MAX,
  brandOpts,
  dailyLevel,
  decodeGameHash,
  encodeGameHash,
  formatTime,
  levelById,
  minimalStep,
  sizeDims,
  starsFor,
  startKinds,
  todayKey,
} from './levels.js';
import { renderShareCard, shareText } from './shareCard.js';
import { RealSizeFace, Ruler, guessScale } from './RealSize.jsx';
import {
  LANGS,
  LANG_LABEL,
  STRINGS,
  formatCm,
  levelText,
} from './i18n.js';
import { PRO } from '../app/proStrings.js';

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

const emptyFor = (level) => Object.fromEntries(startKinds(level).map((k) => [k, null]));
const SCALE_KEY = 'packshift.scale';
const readScale = () => {
  try {
    const v = Number(localStorage.getItem(SCALE_KEY));
    return v >= 0.5 && v <= 2 ? v : null;
  } catch {
    return null;
  }
};
const POP_DELAY = 900; // ms an overfull face holds before the last sticker falls off

export default function Game({ onPro, lang = 'fr', setLang }) {
  const T = STRINGS[lang];
  const cm = (mm) => formatCm(mm, lang);
  const [screen, setScreen] = useState(fromLink ? 'play' : 'intro');
  const [level, setLevel] = useState(fromLink?.level || LEVELS[0]);
  const [brand, setBrand] = useState(fromLink?.brand || STRINGS[lang].defaultBrand);
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
  const [lid, setLid] = useState((fromLink?.level || LEVELS[0]).sizing === 'shrink' ? 0 : OPEN_LID);
  const [progress, setProgress] = useState(readProgress);
  const [toast, setToast] = useState('');
  const [muted, setMutedState] = useState(isMuted);
  const [snapshotReady, setSnapshotReady] = useState(false);
  const [lawArrived, setLawArrived] = useState(false); // new-law level: the twist happened
  const [stamp, setStamp] = useState(false); // "NOUVELLE LOI" overlay
  const [popped, setPopped] = useState(null); // { kind, surface, n }
  const [pops, setPops] = useState(0);
  const [filled, setFilled] = useState(false); // intro: every mention, every language
  const [faceK, setFaceK] = useState(() => readScale() ?? guessScale());
  const [scaling, setScaling] = useState(false);
  const [crack, setCrack] = useState(0); // press level: burst on a pop

  const boardRef = useRef(null);
  const sceneWrap = useRef(null);
  const pickRef = useRef(null);
  const lidAnim = useRef(0);

  const isSandbox = level.id === 'boite';
  const copy = useMemo(() => levelText(level, lang), [level, lang]);

  // Language: <html lang>, the tab title, and the choice remembered.
  useEffect(() => {
    document.title = T.htmlTitle;
  }, [T]);
  const changeLang = (next) => {
    if (next === lang) return;
    // Keep the player's own brand, but swap the default one for the new language.
    setBrand((b) => (b.name === T.defaultBrand.name && b.slogan === T.defaultBrand.slogan ? STRINGS[next].defaultBrand : b));
    setLang?.(next);
    play('tick');
  };
  const opts = isSandbox ? brandOpts(brand, level.market) : undefined;
  const dims = sizeDims(step);
  const pressures = useMemo(() => buildPressure(placements, level.market, dims, opts), [placements, level.market, dims.width, dims.depth, dims.height, opts?.weights?.claim]); // eslint-disable-line react-hooks/exhaustive-deps
  const overloaded = useMemo(() => overloadedSurfaces(pressures), [pressures]);
  const violations = useMemo(() => ruleViolations(placements, level.market), [placements, level.market]);
  const activeKinds = level.kinds.filter((k) => k in placements);
  const unplaced = activeKinds.filter((k) => !placements[k]);
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

  // The intro's "waouh": a beat after the page lands, every mandatory
  // mention in every language is printed on the real-size face — and spills.
  useEffect(() => {
    if (screen !== 'intro') return undefined;
    const id = setTimeout(() => { setFilled(true); play('stamp'); }, reducedMotion() ? 0 : 3200);
    return () => clearTimeout(id);
  }, [screen]);

  const setScale = (v) => {
    setFaceK(v);
    try {
      localStorage.setItem(SCALE_KEY, String(v));
    } catch {
      /* not kept */
    }
  };

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
    const hash = '#' + encodeGameHash({ level, brand: isSandbox ? brand : null, result: null, lang });
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [screen, level, brand, isSandbox, lang]);

  // "Ça ne rentre pas", physically: an overfull face holds for a beat, then
  // the last sticker put on it falls off and bounces back to the tray.
  useEffect(() => {
    if (won || drag || overloaded.length === 0) return undefined;
    const surface = overloaded[0];
    const onFace = order.filter((k) => placements[k] === surface);
    const kind = onFace[onFace.length - 1] || activeKinds.find((k) => placements[k] === surface);
    if (!kind) return undefined;
    const id = setTimeout(() => {
      setPlacements((p) => ({ ...p, [kind]: null }));
      setOrder((o) => o.filter((k) => k !== kind));
      setPopped((prev) => ({ kind, surface, n: (prev?.n || 0) + 1 }));
      setPops((c) => c + 1);
      play('pop');
      if (level.sizing === 'shrink') {
        setCrack(Date.now());
        play('collide');
      }
    }, POP_DELAY);
    return () => clearTimeout(id);
  }, [overloaded.join(), won, drag]); // eslint-disable-line react-hooks/exhaustive-deps

  // New-law level: the moment the first layout works, the law lands.
  useEffect(() => {
    if (won || !level.twist || lawArrived || !fits) return undefined;
    const id = setTimeout(() => {
      setLawArrived(true);
      setPlacements((p) => ({ ...p, [level.twist]: null }));
      setStamp(true);
      play('stamp');
      setTimeout(() => setStamp(false), 6000); // long enough to read; a tap dismisses it
    }, 650);
    return () => clearTimeout(id);
  }, [fits, won, level.twist, lawArrived]);

  // Placement levels win by themselves the moment everything fits.
  useEffect(() => {
    if (won || level.sizing || !fits || (level.twist && !lawArrived)) return undefined;
    const id = setTimeout(() => finish(), 420);
    return () => clearTimeout(id);
  }, [fits, won, level.sizing, lawArrived]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setLawArrived(false);
    setStamp(false);
    setPopped(null);
    setPops(0);
    if (!keepRival) setRival(null);
    if (nextBrand) setBrand(nextBrand);
    lidAnim.current += 1;
    setLid(next.sizing === 'shrink' ? 0 : OPEN_LID); // under the press the lid stays shut
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
    const fill = buildPressure({ ...placements, [kind]: surface }, level.market, dims, opts)[surface];
    setPlacements((p) => ({ ...p, [kind]: surface }));
    setOrder((o) => [...o.filter((k) => k !== kind), kind]);
    setPopped(null);
    countMove();
    play('stick', { intensity: fill }); // the fuller the face, the higher the note
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
    play('fanfare');
    animateLid(0, 1100);
    setTimeout(() => setSnapshotReady(true), 2100); // after the pedestal rises and the camera settles
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
      flash(level.sizing ? T.hintFlash.sizing : T.hintFlash.none);
      setHints((h) => h + 1);
      return;
    }
    const kind = activeKinds.find((k) => solution.placements[k] !== placements[k]);
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
    + encodeGameHash({ level, brand: isSandbox ? brand : null, result: withResult && won ? won : null, lang });

  const verdictFor = () => {
    if (isSandbox) {
      if (won) return T.card.brandFits(brand.name);
      if (best === null) return T.card.sloganNever;
      return T.card.notYetBrand;
    }
    return won ? T.card.solved(won.moves) : T.card.notYet;
  };

  const detailFor = () => {
    if (isSandbox) return T.card.detailBrand(brand.slogan, brand.slogan.length, cm(dims.width));
    return T.card.detail(activeKinds.length, cm(dims.width), won ? formatTime(won.ms) : '');
  };

  const kickerFor = () => (level.id === 'daily' ? copy.title : isSandbox ? copy.title : T.card.kickerLevel(level.id, copy.title));

  const share = async () => {
    unlockAudio();
    const url = shareUrl(true);
    const text = shareText({
      appTitle: T.appTitle,
      faces: T.face,
      title: level.id === 'daily' || isSandbox ? (isSandbox ? `${copy.title} · ${brand.name}` : copy.title) : T.card.textLevel(level.id),
      fits: Boolean(won) || fits,
      stars: won?.stars || 0,
      detail: won ? T.card.textMoves(won.moves, cm(dims.width)) : cm(dims.width),
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
        titleLines: T.cardTitle,
        cartel: {
          house: T.museum.house,
          artist: isSandbox ? (brand.name || T.museum.artist) : T.museum.artist,
          work: isSandbox ? T.museum.workBrand(brand.slogan) : T.museum.work(level.id === 'daily' ? level.key.slice(4) : level.id, copy.title),
          lines: [T.museum.medium(activeKinds.length), T.museum.front(cm(dims.width))],
          acquired: won ? T.museum.acquired : '',
        },
        faces: T.face,
        cta: T.cardCta,
      });
    } catch (error) {
      console.warn('PACKSHIFT: share card failed', error);
    }
    const file = blob ? new File([blob], T.fileName, { type: 'image/png' }) : null;
    // Phones: the native share sheet (image + text straight into WhatsApp,
    // Instagram, Messages…). Desktop: download the card and copy the text.
    if (phone && navigator.share) {
      try {
        if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, title: T.appTitle });
        else await navigator.share({ text, url, title: T.appTitle });
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
      a.download = T.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1500);
    }
    if (copied) flash(blob ? T.toast.downloadedCopied : T.toast.copied);
    else if (blob) flash(T.toast.downloaded);
    else window.prompt(T.toast.copyPrompt, text);
  };

  const copyChallenge = async () => {
    const url = shareUrl(true);
    try {
      await navigator.clipboard.writeText(url);
      flash(T.toast.challengeCopied);
    } catch {
      window.prompt(T.toast.linkPrompt, url);
    }
  };

  /* ------------------------------ copy ------------------------------ */

  const S = T.status;
  const status = (() => {
    if (won) return { tone: 'win', text: S.ok };
    if (hint?.impossible) return { tone: 'hot', text: level.sizing === 'shrink' ? S.impossibleShrink : S.impossibleGrow };
    const v = violations[0];
    if (v?.kind === 'claim') return { tone: 'hot', text: S.sloganFront };
    if (v?.kind === 'barcode') return { tone: 'hot', text: S.barcodeFront };
    if (popped && !overloaded.length) {
      if (isSandbox && popped.kind === 'claim') return { tone: 'hot', text: best === null ? S.sloganNever : S.sloganLong };
      if (level.sizing === 'grow' && pops >= 2) return { tone: 'hot', text: T.poppedGrow };
      return { tone: 'hot', text: T.popped(T.plain[popped.kind].name, T.face[popped.surface]) };
    }
    if (overloaded.length) {
      const f = overloaded.map((x) => T.face[x]).join(' + ');
      if (level.sizing === 'grow' && allPlaced && moves >= 6) return { tone: 'hot', text: S.growHint(f) };
      if (isSandbox && placements.claim === 'FRONT' && overloaded.includes('FRONT')) return { tone: 'hot', text: best === null ? S.sloganNever : S.sloganLong };
      return { tone: 'hot', text: S.overflow(f) };
    }
    if (!allPlaced) return { tone: 'ink', text: unplaced.length === activeKinds.length ? S.start : S.remaining(unplaced.length) };
    if (level.sizing === 'shrink') return { tone: 'ok', text: step > (best ?? step) ? S.shrinkMore : S.shrinkFinal };
    if (level.sizing === 'grow') return { tone: 'ok', text: step > (best ?? step) ? S.growSmaller : S.growFinal };
    if (isSandbox) return { tone: 'ok', text: S.sandboxOk };
    return { tone: 'ok', text: S.ok };
  })();

  const noteFor = (kind) => {
    if (won) return null;
    if (level.id === 1 && moves === 0 && kind === 'claim') return [T.notes.dragMe, 'ink'];
    if (hint?.kind === kind) return [`→ ${T.face[hint.surface]}`, 'blue'];
    const surface = placements[kind];
    if (!surface) return null;
    if (violations.some((v) => v.kind === kind)) return [kind === 'claim' ? T.notes.notSeen : T.notes.notHere, 'pen'];
    if (overloaded.includes(surface)) {
      const onFace = order.filter((k) => placements[k] === surface);
      if (onFace[onFace.length - 1] === kind) return [T.notes.noRoom, 'pen'];
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
        label={T.plain[kind].name}
        ariaLabel={T.charAria(T.plain[kind].name)}
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
    viewMode: won ? 'MUSEUM' : level.sizing === 'shrink' ? 'PRESS' : 'GAME',
    decomposition: lid,
    pedestal: Boolean(won),
    press: level.sizing === 'shrink' && !won,
    placements,
    brief: activeKinds,
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
    brand: isSandbox ? { name: brand.name, slogan: brand.slogan, tagline: T.boxTagline } : null,
    labels: PRO[lang].scene,
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
          <nav className="g-lang" aria-label={T.langNav}>
            {LANGS.map((l) => (
              <button key={l} className={l === lang ? 'on' : ''} aria-pressed={l === lang} lang={l} onClick={() => changeLang(l)}>{LANG_LABEL[l]}</button>
            ))}
          </nav>
          <button className="g-link" onClick={onPro}>{T.pro}</button>
        </header>
        <section className="real-intro" key={lang}>
          <div className="ri-head">
            <p className="g-kicker ri-kicker">{T.real.kicker}</p>
            <h1 className="ri-title">{T.real.title}</h1>
            <p className="ri-sub">{T.real.sub}</p>
          </div>

          <div className="ri-stage">
            <div className="ri-face-row">
              <div className="ri-face-col">
                <RealSizeFace T={T} lang={lang} filled={filled} k={faceK} onPlay={() => startLevel(LEVELS[0])} />
                <Ruler k={faceK} />
              </div>
              <div className="ri-card" style={{ width: 323.5 * faceK, height: 204 * faceK }} aria-hidden="true">
                <span>{T.real.card}</span>
              </div>
            </div>
            <div className="ri-tools">
              <button type="button" className={filled ? 'on' : ''} onClick={() => { setFilled((f) => !f); play(filled ? 'tick' : 'stamp'); }}>{filled ? T.real.unfill : T.real.fill}</button>
              <button type="button" onClick={() => setScaling((v) => !v)} aria-expanded={scaling}>{T.real.scale}</button>
              <small>{T.real.approx}</small>
            </div>
            {scaling && (
              <label className="ri-scale">
                <span>{T.real.scale}</span>
                <input type="range" min="0.6" max="1.9" step="0.01" value={faceK} onChange={(e) => setScale(Number(e.target.value))} />
              </label>
            )}
            <p className={'ri-note' + (filled ? ' hot' : '')} key={String(filled)}>{filled ? T.real.filled : T.real.sub}</p>
          </div>

          <div className="ri-foot">
            <p className="hook-1">{T.hook1[0]}<mark>{T.hook1[1]}</mark></p>
            <p className="hook-3">{T.hook3[0]}<em>{T.hook3[1]}</em></p>
            <h2 className="hook-q">{T.appTitle}</h2>
            <button className="g-cta" onClick={() => startLevel(LEVELS[0])} onPointerEnter={preloadScene}>
              {T.play} <small>{T.playSub}</small>
            </button>
            <div className="hook-more">
              <button onClick={() => startLevel(daily)}>{T.daily} <small>{levelText(daily, lang).date}</small></button>
              <button onClick={() => startLevel(SANDBOX)}>{T.create} <small>{T.createSub}</small></button>
            </div>
          </div>
        </section>
        <footer className="g-foot">{T.disclaimer}</footer>
      </main>
    );
  }

  /* ------------------------------ play ------------------------------ */

  return (
    <main className={`game play${selectedKind ? ' is-selecting' : ''}${drag ? ' is-dragging-char' : ''}${won ? ' is-won' : ''}`} ref={boardRef}>
      <header className="g-top">
        <button className="g-back" onClick={() => { setScreen('intro'); window.history.replaceState(null, '', window.location.pathname); }} aria-label={T.back}>←</button>
        <nav className="g-levels" aria-label={T.levelsNav}>
          {LEVELS.map((l) => (
            <button key={l.id} className={(level.id === l.id ? 'on ' : '') + (progress[levelKey(l)] ? 'done' : '')} onClick={() => startLevel(l)} aria-label={T.levelAria(l.id, levelText(l, lang).title)}>
              {l.id}
              {progress[levelKey(l)] && <i>{'★'.repeat(progress[levelKey(l)].stars)}</i>}
            </button>
          ))}
          <button className={level.id === 'daily' ? 'on' : ''} onClick={() => startLevel(daily)}>{T.dayShort}</button>
          <button className={isSandbox ? 'on' : ''} onClick={() => startLevel(SANDBOX)}>{T.levels.boite.title}</button>
        </nav>
        <div className="g-meter" aria-live="off">
          <span><b>{moves}</b> {T.moves(moves)}</span>
          <span><b>{formatTime(elapsed)}</b></span>
          <button onClick={toggleSound} className="g-sound" aria-pressed={!muted} aria-label={muted ? T.soundOff : T.soundOn}>{muted ? '♪̸' : '♪'}</button>
          <nav className="g-lang" aria-label={T.langNav}>
              {LANGS.map((l) => (
                <button key={l} className={l === lang ? 'on' : ''} aria-pressed={l === lang} lang={l} onClick={() => changeLang(l)}>{LANG_LABEL[l]}</button>
              ))}
            </nav>
        </div>
      </header>

      <section className="g-mission">
        <p className="g-kicker">{typeof level.id === 'number' ? T.kickerLevel(level.id, LEVELS.length) : copy.title} · {T.market[level.market]}</p>
        <h1>{copy.title}</h1>
        <p className="g-goal">{copy.goal}</p>
        <ul className="g-rules">
          {copy.rules.map((rule) => <li key={rule}>{rule}</li>)}
          {lawArrived && <li className="g-rule-new"><b>{T.twist.newTag}</b> {T.rules.bilingual}</li>}
        </ul>
        {rival && !won && (
          <p className="g-rival">{T.rival(rival.moves, level.sizing ? T.rivalSize(cm(sizeDims(rival.step).width)) : T.rivalTime(formatTime(rival.seconds * 1000)))}</p>
        )}
      </section>

      {isSandbox && (
        <section className="g-brand">
          <label>
            <span>{T.productName}</span>
            <input value={brand.name} maxLength={NAME_MAX} disabled={Boolean(won)} onChange={(e) => setBrand((b) => ({ ...b, name: e.target.value }))} />
          </label>
          <label className="g-slogan">
            <span>{T.yourSlogan} <em className={brand.slogan.length > 22 ? 'hot' : ''}>{brand.slogan.length} / {SLOGAN_MAX}</em></span>
            <span className="g-slogan-row">
              <input value={brand.slogan} maxLength={SLOGAN_MAX} disabled={Boolean(won)} onChange={(e) => setBrand((b) => ({ ...b, slogan: e.target.value }))} placeholder={T.sloganPlaceholder} />
              <button
                type="button"
                className="g-dice"
                disabled={Boolean(won)}
                aria-label={T.dice}
                title={T.dice}
                onClick={(e) => {
                  e.preventDefault();
                  const pool = T.slogans.filter((x) => x !== brand.slogan);
                  setBrand((b) => ({ ...b, slogan: pool[Math.floor(Math.random() * pool.length)] }));
                  play('tick');
                }}
              >🎲</button>
            </span>
          </label>
        </section>
      )}

      <div className="g-board">
        <div className={'g-stage' + (drag?.target && drag.target !== 'TRAY' ? ' targeted' : '') + (won ? ' museum' : '') + (level.sizing === 'shrink' && !won ? ' press' : '')} ref={sceneWrap}>
          <Suspense fallback={<div className="g-loading">{T.loading}</div>}>
            <GameScene {...sceneProps} />
          </Suspense>
          {level.sizing === 'shrink' && !won && (
            <div className="g-press-hud" aria-hidden="true">
              <small>{T.press.kicker}</small>
              <b>{cm(dims.width)}</b>
            </div>
          )}
          {crack > 0 && level.sizing === 'shrink' && !won && <div className="g-crack" key={crack} aria-hidden="true">{T.press.crack}</div>}
          <p className={'g-status tone-' + status.tone} role="status" aria-live="polite" key={status.text}>{status.text}</p>
        </div>

        <div className="g-side">
          <p className="g-faces-head"><b>{T.facesHead[0]}</b> · {T.facesHead[1]}</p>
          <div className="g-faces">
            {FACE_ORDER.map((surface) => {
              const load = pressures[surface];
              const p = preview?.surface === surface ? preview.to : null;
              const who = activeKinds.filter((k) => placements[k] === surface);
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
                    <b>{T.face[surface]}</b>
                    <em className={(p ?? load) > 1 ? 'hot' : ''}>{Math.round((p ?? load) * 100)}%</em>
                  </div>
                  <div className="g-gauge" aria-hidden="true">
                    <span className="g-seg base" style={{ bottom: 0, height: Math.min(100, base * 100) + '%' }} title={T.already[level.market][surface]} />
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
                    {who.map((k, i) => renderChar(k, i, 0.5, 'mini' + (won ? ' happy' : over ? ' squeezed' : load > 0.85 ? ' worried' : '')))}
                  </div>
                  <small className="g-already">{T.alreadyPrinted} {T.already[level.market][surface]}</small>
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
              <span>{unplaced.length ? T.toStick(unplaced.length) : T.allStuck}</span>
              {!won && <button onClick={(e) => { e.stopPropagation(); giveHint(); }}>{T.hint} {hints ? `(${hints})` : ''}</button>}
            </div>
            <div className="g-tray-cast">
              {unplaced.map((k, i) => renderChar(k, i, 0.78, (popped?.kind === k ? `bounced n${popped.n % 2}` : '') + (lawArrived && k === level.twist ? ' arrived' : '')))}
            </div>
            {selectedKind && (
              <p className="g-why"><b>{T.plain[selectedKind].name}</b> — {T.plain[selectedKind].why} <span>{T.tapFace}</span></p>
            )}
          </div>

          {level.sizing && (
            <div className="g-size">
              <label>
                <span>{level.sizing === 'shrink' ? T.press.lower : T.boxSize}</span>
                <input
                  type="range"
                  min={SIZE_MIN}
                  max={SIZE_MAX}
                  value={step}
                  disabled={Boolean(won)}
                  onChange={(e) => resize(Number(e.target.value))}
                  aria-label={T.boxSize}
                  style={{ '--v': ((step - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)) * 100 }}
                />
                <output>{cm(dims.width)} <small>× {cm(dims.height)}</small></output>
              </label>
              {!won && <button className="g-cta small" disabled={!fits} onClick={finish}>{isSandbox ? T.validateBox : T.finalSize}</button>}
            </div>
          )}

          <div className="g-actions">
            <button onClick={reset} disabled={moves === 0 && step === (level.step || 0)}>{T.restart}</button>
            {won?.hidden
              ? <button className="g-cta small" onClick={() => setWon((w) => ({ ...w, hidden: false }))}>{T.myScore}</button>
              : <button onClick={share}>{T.share}</button>}
          </div>
          <nav className="g-lang g-lang-foot" aria-label={T.langNav}>
            {LANGS.map((l) => (
              <button key={l} className={l === lang ? 'on' : ''} aria-pressed={l === lang} lang={l} onClick={() => changeLang(l)}>{LANG_LABEL[l]}</button>
            ))}
          </nav>
        </div>
      </div>

      {won && !won.hidden && (
        <aside className="g-win" role="dialog" aria-label={T.win.aria}>
          <div className="g-burst" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => {
              const kind = Object.keys(CAST)[i % 6];
              return <span key={i} className={`char-${CAST[kind].shape}`} style={{ '--i': i, background: CAST[kind].color }} />;
            })}
          </div>
          <p className="g-house">{T.museum.house}</p>
          <div className="g-cartel">
            <b className="g-artist">{isSandbox ? (brand.name || T.museum.artist) : T.museum.artist}</b>
            <i className="g-work">{isSandbox ? T.museum.workBrand(brand.slogan) : T.museum.work(level.id === 'daily' ? level.key.slice(4) : level.id, copy.title)}</i>
            <span>{T.museum.medium(activeKinds.length)} {T.museum.front(cm(won.width))}</span>
            <span>{T.museum.collection}</span>
            <hr />
            <div className="g-acq">
              <span>{T.museum.acquired}{!isSandbox && <em aria-label={T.win.starsAria(won.stars)}> {'★'.repeat(won.stars)}<u>{'★'.repeat(3 - won.stars)}</u></em>}</span>
              <span className="g-reddot" title={T.museum.dot} />
            </div>
            <span className="g-score-line">{T.win.score(won.moves, formatTime(won.ms), cm(won.width))}</span>
            {level.sizing && best !== null && won.step > best && <em className="g-record">{T.win.record(cm(sizeDims(best).width))}</em>}
          </div>
          {beatRival !== null && <p className="g-vs">{beatRival ? T.win.beat : T.win.lost}</p>}
          <p className="g-fact">{copy.fact}</p>
          <div className="g-win-actions">
            <button className="g-cta" onClick={share} disabled={!snapshotReady}>{snapshotReady ? T.win.shareScore : '…'}</button>
            <button onClick={copyChallenge}>{T.win.challenge}</button>
            {nextLevel && <button onClick={() => startLevel(nextLevel)}>{T.win.next}</button>}
            {!nextLevel && level.id === LEVELS.length && <button onClick={() => startLevel(daily)}>{T.win.dailyArrow}</button>}
            {(level.id === 'daily' || isSandbox) && <button onClick={() => startLevel(isSandbox ? daily : SANDBOX)}>{isSandbox ? T.win.dailyArrow : T.win.createArrow}</button>}
            <button className="g-link" onClick={() => setWon((w) => ({ ...w, hidden: true }))}>{T.win.seeBox}</button>
          </div>
        </aside>
      )}

      {stamp && (
        <div className="g-stamp" role="alert" onClick={() => setStamp(false)}>
          <b>{T.twist.stamp}</b>
          <p>{T.twist.body}</p>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}

      {drag && (
        <div className="drag-ghost" style={{ transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -60%) rotate(${Math.max(-18, Math.min(18, drag.vx))}deg)` }} aria-hidden="true">
          <span className="char-body" style={{ width: CAST[drag.kind].w, height: CAST[drag.kind].h, background: CAST[drag.kind].color }} data-shape={CAST[drag.kind].shape}>
            <span className="eyes"><i><b /></i><i><b /></i></span>
          </span>
          <small>
            {drag.target === 'TRAY' ? T.unstick : drag.target ? `→ ${T.face[drag.target]}${preview ? ` · ${Math.round(preview.to * 100)}%` : ''}` : T.plain[drag.kind].name}
          </small>
        </div>
      )}
    </main>
  );
}
