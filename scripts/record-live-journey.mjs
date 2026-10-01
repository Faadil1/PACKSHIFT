import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT = process.env.PACKSHIFT_RECORD_DIR || 'artifacts/live-journey';
const BASE = process.env.PACKSHIFT_BASE_URL || 'http://127.0.0.1:4173';
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--disable-dev-shm-usage',
  ],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
});

const page = await context.newPage();
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(String(error)));
page.on('console', (msg) => {
  if (msg.type() === 'error') browserErrors.push('console: ' + msg.text());
});

const sleep = (ms) => page.waitForTimeout(ms);

async function setRange(locator, value) {
  await locator.evaluate((el, next) => {
    el.value = String(next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function solveVisibleLevel() {
  for (let i = 0; i < 8; i += 1) {
    const remaining = await page.locator('.g-tray-cast .char').count();
    if (!remaining) return;
    const hint = page.locator('.g-tray-head button').first();
    await hint.click();
    const target = page.locator('.g-face.hinted').first();
    await target.waitFor({ state: 'visible', timeout: 5000 });
    await sleep(240);
    await target.evaluate((el) => el.click());
    await sleep(520);
  }
  throw new Error('Could not place every visible requirement with hints.');
}

try {
  await page.goto(BASE + '/?lang=fr', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('.real-intro').waitFor({ state: 'visible', timeout: 15000 });

  // Real-size opening: arrive calm, then let the mandatory-copy overflow happen.
  await sleep(3700);
  await sleep(900);

  // Hand the same real-size object into the game.
  await page.locator('.ri-foot .g-cta').click();
  await page.locator('.play').waitFor({ state: 'visible', timeout: 12000 });
  await sleep(1500);

  // Jump to the hydraulic-press challenge; this remains the same physical box.
  const level5 = page.locator('.g-levels button').filter({ hasText: /^5$/ });
  await level5.click();
  await page.locator('.g-stage.press').waitFor({ state: 'visible', timeout: 12000 });
  await sleep(1800);

  // First arrange a valid nominal box.
  await solveVisibleLevel();
  await sleep(1000);

  // Make the box physically smaller in visible steps until it cannot hold the brief.
  const slider = page.locator('.g-size input[type="range"]');
  for (const value of [-1, -2, -3, -4, -5, -6]) {
    await setRange(slider, value);
    await sleep(360);
  }

  // Hold on the actual CRAC consequence.
  await page.locator('.g-crack').waitFor({ state: 'visible', timeout: 5000 });
  await sleep(520);

  // Recover: release pressure, then re-place what the surface rejected.
  for (const value of [-5, -4, -3, -2, -1, 0]) {
    await setRange(slider, value);
    await sleep(180);
  }
  await sleep(500);
  await solveVisibleLevel();
  await sleep(850);

  // Validate the final form.
  const finalButton = page.locator('.g-size .g-cta.small');
  await finalButton.waitFor({ state: 'visible', timeout: 5000 });
  await finalButton.click();

  // Museum: the same object, now carrying the history of the negotiation.
  await page.locator('.g-win').waitFor({ state: 'visible', timeout: 8000 });
  await page.locator('.g-provenance').waitFor({ state: 'visible', timeout: 8000 });
  const provenance = (await page.locator('.g-provenance').innerText()).replace(/\s+/g, ' ').trim();
  console.log('PACKSHIFT_PROVENANCE:', provenance);
  await sleep(5200);

  await page.screenshot({ path: path.join(OUT, 'museum-final.png'), fullPage: false });
  if (!/CRAC|rejet|surcharge|réduite/i.test(provenance)) {
    throw new Error('Museum provenance did not retain the expected journey history: ' + provenance);
  }

  if (browserErrors.length) {
    console.log('PACKSHIFT_BROWSER_ERRORS:', JSON.stringify(browserErrors, null, 2));
  }
} finally {
  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();
  if (video) {
    const source = await video.path();
    const target = path.join(OUT, 'packshift-live-journey.webm');
    await fs.copyFile(source, target);
    console.log('PACKSHIFT_VIDEO:', target);
  }
}
