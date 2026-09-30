// Synthesised sound design (Web Audio, no audio files).
//
// crease   — dry paper click with a short board thump (every hinge that folds)
// whoosh   — filtered noise sweep (a requirement travelling between panels)
// collide  — low muted thud (a surface going over capacity)
// resolve  — soft two-note chime (valid form)
// tick     — tiny UI click
//
// Audio only starts after a user gesture (browser autoplay policy) and can be
// muted; the choice is remembered per viewer.

let ctx = null;
let master = null;
let muted = false;

try {
  muted = window.localStorage?.getItem('packshift:muted') === '1';
} catch {
  muted = false;
}

function ensure() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() {
  ensure();
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  try {
    window.localStorage?.setItem('packshift:muted', value ? '1' : '0');
  } catch {
    /* private mode: preference just isn't remembered */
  }
  if (master) master.gain.setTargetAtTime(value ? 0 : 0.55, ctx.currentTime, 0.02);
}

function noiseBuffer(ac, seconds) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * seconds), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function envelope(gain, t, attack, peak, release) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
}

const recipes = {
  crease(ac, t, intensity = 1) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, 0.08);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400 + Math.random() * 1400;
    bp.Q.value = 1.4;
    const g = ac.createGain();
    envelope(g, t, 0.002, 0.35 * intensity, 0.06);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.08);
    const og = ac.createGain();
    envelope(og, t, 0.003, 0.18 * intensity, 0.09);
    osc.connect(og).connect(master);
    osc.start(t);
    osc.stop(t + 0.12);
  },
  whoosh(ac, t) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, 0.7);
    const lp = ac.createBiquadFilter();
    lp.type = 'bandpass';
    lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.65);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.68);
    src.connect(lp).connect(g).connect(master);
    src.start(t);
  },
  collide(ac, t) {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.35);
    const g = ac.createGain();
    envelope(g, t, 0.005, 0.5, 0.4);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    osc.connect(lp).connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.5);
  },
  resolve(ac, t) {
    [659.25, 987.77].forEach((f, i) => {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ac.createGain();
      envelope(g, t + i * 0.11, 0.01, 0.16, 0.9);
      osc.connect(g).connect(master);
      osc.start(t + i * 0.11);
      osc.stop(t + i * 0.11 + 1.1);
    });
  },
  tick(ac, t) {
    const osc = ac.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1800;
    const g = ac.createGain();
    envelope(g, t, 0.001, 0.05, 0.02);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.04);
  },
};

export function play(name, { delay = 0, intensity = 1 } = {}) {
  if (muted) return;
  const ac = ensure();
  if (!ac || ac.state !== 'running' || !recipes[name]) return;
  recipes[name](ac, ac.currentTime + delay, intensity);
}
