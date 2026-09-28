const base = { market: 'EU', bilingual: false, dataCarrier: false, claim: false, compiled: false };
let state = { ...base };
let running = false;
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function pressure() {
  let value = state.market === 'EU' ? 28 : 22;
  if (state.bilingual) value += 18;
  if (state.dataCarrier) value += 12;
  if (state.claim) value += 20;
  return value;
}
function collision() { return pressure() >= 70 && !state.compiled; }
function setState(patch, preserveCompiled = false) {
  state = { ...state, ...patch };
  if (!preserveCompiled && !Object.prototype.hasOwnProperty.call(patch, 'compiled')) state.compiled = false;
  render();
}
function renderToggle(id, active) {
  const el = $(id); el.classList.toggle('checked', active); el.querySelector('.toggle-indicator').textContent = active ? '×' : '+';
}
function runtimeRow(id, active, value) {
  const el = $(id); el.classList.toggle('active', active); el.querySelector('strong').textContent = active ? value : '—';
}
function render() {
  const p = pressure(); const hit = collision();
  $('marketEU').classList.toggle('active', state.market === 'EU');
  $('marketCA').classList.toggle('active', state.market === 'CANADA');
  renderToggle('toggleBilingual', state.bilingual); renderToggle('toggleData', state.dataCarrier); renderToggle('toggleClaim', state.claim);
  $('pressureValue').textContent = `${p}%`; $('pressureBar').style.width = `${Math.min(100,p)}%`;
  $('forceLeft').style.opacity = state.bilingual || state.claim ? 1 : 0; $('forceRight').style.opacity = state.dataCarrier ? 1 : 0;
  $('stage').classList.toggle('is-collision', hit); $('stage').classList.toggle('is-compiled', state.compiled);
  $('cartonWrap').className = `carton-wrap ${state.market.toLowerCase()}`;
  const density = state.compiled ? Math.max(.72, 1 - p / 330) : 1; $('cartonWrap').style.setProperty('--density', density);
  $('productName').innerHTML = state.market === 'EU' && state.bilingual ? 'BOISSON<br/>D’AVOINE' : 'OAT<br/>MILK';
  $('descriptor').innerHTML = `Smooth & creamy<br/>${state.bilingual ? 'Onctueuse et crémeuse' : 'Plant-based'}<br/>No added sugar`;
  $('marketCode').textContent = state.market === 'EU' ? 'EU' : 'CA';
  $('claim').style.display = state.claim ? 'block' : 'none'; $('claim').classList.toggle('claim-collision', hit);
  $('qr').style.display = state.dataCarrier ? 'block' : 'none';
  $('collisionNote').classList.toggle('show', hit); $('compileTrace').classList.toggle('show', state.compiled);
  const status = hit ? 'COLLISION' : state.compiled ? 'VALID FORM' : 'OPEN'; $('status').textContent = status; $('status').className = status.toLowerCase().replace(' ', '-');
  $('mandatoryValue').textContent = state.market === 'EU' ? '+28%' : '+22%';
  runtimeRow('rowLang', state.bilingual, '+18%'); runtimeRow('rowData', state.dataCarrier, '+12%'); runtimeRow('rowClaim', state.claim, '+20%');
  $('validCard').classList.toggle('show', state.compiled); $('validText').textContent = `VALID FOR ${state.market}`;
  $('compile').classList.toggle('urgent', hit);
}

$('marketEU').onclick = () => setState({ market:'EU' });
$('marketCA').onclick = () => setState({ market:'CANADA' });
$('toggleBilingual').onclick = () => setState({ bilingual:!state.bilingual });
$('toggleData').onclick = () => setState({ dataCarrier:!state.dataCarrier });
$('toggleClaim').onclick = () => setState({ claim:!state.claim });
$('compile').onclick = () => setState({ compiled:true }, true);
$('runDemo').onclick = async () => {
  if (running) return; running = true; $('runDemo').disabled = true; $('runDemo').textContent = 'RUNNING…';
  state={...base}; render(); await wait(900);
  state={...base, market:'EU'}; render(); await wait(900);
  state={...base, market:'EU', bilingual:true}; render(); await wait(900);
  state={...base, market:'EU', bilingual:true, dataCarrier:true}; render(); await wait(900);
  state={...base, market:'EU', bilingual:true, dataCarrier:true, claim:true}; render(); await wait(1200);
  state={...base, market:'EU', bilingual:true, dataCarrier:true, claim:true, compiled:true}; render(); await wait(1500);
  state={market:'CANADA', bilingual:true, dataCarrier:true, claim:true, compiled:true}; render();
  running=false; $('runDemo').disabled=false; $('runDemo').textContent='RUN 15S DEMO';
};
render();
