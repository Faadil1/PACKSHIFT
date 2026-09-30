import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, STRINGS, detectLang, formatCm, levelText } from '../src/game/i18n.js';
import { LEVELS, SANDBOX, dailyLevel, decodeGameHash, encodeGameHash } from '../src/game/levels.js';

// Walk an object and list "path:type" for every leaf, so shapes can be compared.
function shape(value, path = '') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).sort().flatMap((k) => shape(value[k], path ? `${path}.${k}` : k));
  }
  return [`${path}:${Array.isArray(value) ? `array${value.length}` : typeof value}`];
}

test('every language has exactly the same keys as French', () => {
  const ref = shape(STRINGS.fr);
  for (const lang of LANGS) assert.deepEqual(shape(STRINGS[lang]), ref, lang);
});

test('no empty strings, and every template returns text', () => {
  for (const lang of LANGS) {
    const walk = (v, path) => {
      if (typeof v === 'string') assert.ok(v.trim().length > 0, `${lang}.${path}`);
      else if (typeof v === 'function') assert.equal(typeof v(2, 'x', 'y'), 'string', `${lang}.${path}`);
      else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, `${path}.${k}`));
    };
    walk(STRINGS[lang], '');
  }
});

test('every level, the daily and the sandbox have copy in every language', () => {
  for (const lang of LANGS) {
    for (const level of [...LEVELS, SANDBOX, dailyLevel('20260930')]) {
      const t = levelText(level, lang);
      assert.ok(t.title && t.goal && t.fact, `${lang} ${level.id}`);
      assert.ok(t.rules.length >= 1);
    }
  }
  assert.equal(levelText(LEVELS[1], 'en').rules.length, 2, 'Canada adds the bilingual rule');
});

test('language detection: ?lang > saved choice > browser > link > English', () => {
  assert.equal(detectLang({ search: '?lang=es', stored: 'fr', navigatorLangs: ['en-US'] }), 'es');
  assert.equal(detectLang({ stored: 'fr', navigatorLangs: ['en-US'] }), 'fr');
  assert.equal(detectLang({ navigatorLangs: ['de-DE', 'es-MX'] }), 'es');
  assert.equal(detectLang({ navigatorLangs: ['de-DE'], linkLang: 'fr' }), 'fr');
  assert.equal(detectLang({ navigatorLangs: ['ja-JP'] }), 'en');
  assert.equal(detectLang({ search: '?lang=xx', navigatorLangs: [] }), 'en');
});

test('centimetres follow the locale', () => {
  assert.equal(formatCm(56, 'en'), '5.6 cm');
  assert.equal(formatCm(56, 'fr'), '5,6 cm');
  assert.equal(formatCm(56, 'es'), '5,6 cm');
});

test('share links carry the sender language', () => {
  const d = decodeGameHash('#' + encodeGameHash({ level: LEVELS[2], lang: 'es' }));
  assert.equal(d.lang, 'es');
  assert.equal(decodeGameHash('#jeu=1').lang, null);
});

test('the pro studio copy has the same shape in every language', async () => {
  const { PRO } = await import('../src/app/proStrings.js');
  const ref = shape(PRO.fr);
  for (const lang of LANGS) assert.deepEqual(shape(PRO[lang]), ref, lang);
  for (const lang of LANGS) assert.equal(PRO[lang].steps.length, 6);
});
