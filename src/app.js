const state = {
  market: 'EU',
  language: false,
  data: false,
  claim: false,
  compiled: false,
  compiling: false,
  runningDemo: false,
};

const $ = (id) => document.getElementById(id);
const studio = $('studio');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduceMotion ? Math.min(ms, 60) : ms));

function collisionActive() {
  return state.language && state.data && state.claim && !state.compiled && !state.compiling;
}

function activeCount() {
  return [state.language, state.data, state.claim].filter(Boolean).length;
}

function setConstraint(key, value) {
  if (state.compiling || state.runningDemo) return;
  state[key] = value;
  state.compiled = false;
  render();
}

function render() {
  const collision = collisionActive();

  studio.classList.toggle('has-language', state.language);
  studio.classList.toggle('has-data', state.data);
  studio.classList.toggle('has-claim', state.claim);
  studio.classList.toggle('is-collision', collision);
  studio.classList.toggle('is-compiling', state.compiling);
  studio.classList.toggle('is-compiled', state.compiled);

  $('toggleBilingual').classList.toggle('active', state.language);
  $('toggleData').classList.toggle('active', state.data);
  $('toggleClaim').classList.toggle('active', state.claim);

  $('marketEU').classList.toggle('active', state.market === 'EU');
  $('marketCA').classList.toggle('active', state.market === 'CANADA');

  const bilingual = state.language;
  $('packTitle').innerHTML = state.market === 'EU' && bilingual ? 'OAT<br>DRINK' : 'OAT<br>MILK';
  $('packDescription').innerHTML = bilingual
    ? 'Smooth & creamy<br>Onctueux & crémeux<br>No added sugar'
    : 'Smooth & creamy<br>Plant-based<br>No added sugar';
  $('marketCode').textContent = state.market === 'EU' ? 'EU' : 'CA';
  $('backMarket').textContent = state.market === 'EU' ? 'EU' : 'CA';
  $('topMarket').textContent = state.market === 'EU' ? 'EU' : 'CA';
  $('backCopy').textContent = state.market === 'EU'
    ? 'Ingredients, disposal and mandatory copy resolve here when the front surface reaches its limit.'
    : 'Bilingual product, recycling and market copy resolve here when the front surface reaches its limit.';

  let step = 'ONE MASTER';
  let hint = 'Add a constraint. Watch the package make room for it.';
  let status = 'SURFACE STABLE';
  let sub = activeCount() === 0 ? 'One source. No active collision.' : `${activeCount()} constraint${activeCount() === 1 ? '' : 's'} occupying the package.`;

  if (state.language && !state.data && !state.claim) {
    step = 'LANGUAGE ENTERS';
    hint = 'Copy takes width. The front panel starts negotiating space.';
  }
  if (state.data && !state.claim) {
    step = 'DATA CLAIMS A FACE';
    hint = 'The QR cannot float outside the package. It needs a real surface.';
  }
  if (collision) {
    step = 'THE CLAIM DOES NOT FIT';
    hint = 'Two requirements now want the same front-panel territory.';
    status = 'COLLISION';
    sub = 'Surface demand exceeds the current hierarchy.';
  }
  if (state.compiling) {
    step = 'COMPILE THE SURFACE';
    hint = 'Open the package. Move content. Rebalance hierarchy. Refold.';
    status = 'REFLOWING';
    sub = 'The dieline is temporarily becoming the interface.';
  }
  if (state.compiled) {
    step = 'VALID FORM';
    hint = 'Same source. Rebalanced surfaces. Calm again.';
    status = `VALID FORM / ${state.market}`;
    sub = 'Compiled demo state resolved.';
  }

  $('sceneStep').textContent = step;
  $('sceneHint').textContent = hint;
  $('statusText').textContent = status;
  $('statusSub').textContent = sub;

  $('compile').disabled = state.compiling || activeCount() === 0;
}

async function compileSurface() {
  if (state.compiling || activeCount() === 0) return;
  state.compiling = true;
  state.compiled = false;
  render();
  await wait(1800);
  state.compiling = false;
  state.compiled = true;
  render();
}

async function changeMarket(market) {
  if (state.compiling || state.runningDemo) return;
  if (state.market === market) return;
  state.market = market;
  state.compiled = false;
  render();
}

async function runDemo() {
  if (state.runningDemo) return;
  state.runningDemo = true;
  $('runDemo').textContent = 'RUNNING…';
  $('compile').disabled = true;

  Object.assign(state, {
    market: 'EU',
    language: false,
    data: false,
    claim: false,
    compiled: false,
    compiling: false,
  });
  render();
  await wait(1300);

  state.language = true;
  render();
  await wait(1500);

  state.data = true;
  render();
  await wait(1500);

  state.claim = true;
  render();
  await wait(1700);

  await compileSurface();
  await wait(1500);

  state.market = 'CANADA';
  state.compiled = false;
  render();
  await wait(1000);

  await compileSurface();
  await wait(1100);

  state.runningDemo = false;
  $('runDemo').textContent = 'RUN 15S DEMO';
  render();
}

$('toggleBilingual').addEventListener('click', () => setConstraint('language', !state.language));
$('toggleData').addEventListener('click', () => setConstraint('data', !state.data));
$('toggleClaim').addEventListener('click', () => setConstraint('claim', !state.claim));
$('compile').addEventListener('click', compileSurface);
$('runDemo').addEventListener('click', runDemo);
$('marketEU').addEventListener('click', () => changeMarket('EU'));
$('marketCA').addEventListener('click', () => changeMarket('CANADA'));

render();
