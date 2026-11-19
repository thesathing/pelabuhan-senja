// PELABUHAN SENJA — Playwright capture + verification (part 4).
// Drives the 4 scripted shots through the game's own staging handle, asserts
// each one in-page (raycasts, framing, cards), screenshots at 2560x1440
// (deviceScaleFactor 2 over a 1280x720 viewport), downscales to 1280x720 JPEG
// via tests/measure-shots.py, then runs the city-map check. Exits non-zero
// on any failed assertion, console error, failed request, external request,
// or oversized screenshot.
//
// Headless runs on Meta Chromium + swiftshader through the file:// bridge
// (direct navigation to 127.0.0.1 is blocked by the LNA check); the WebGL
// policy file and the bridge are recreated here if /tmp was wiped.
import { spawn, execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(new URL('../../../playwright-tools/package.json', import.meta.url));
const { chromium } = require('playwright-core');

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SHOTS_DIR = join(ROOT, 'screenshots');
const TMP_DIR = '/tmp/r3-shots';
const BRIDGE = '/tmp/bridge-blencong.html';
const POLICY = '/tmp/policy-all.txt';
const POLICY_CONTENT = 'hatch-webgl-all-origins-v1\n';
const BRIDGE_CONTENT = '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>bridge</title></head>\n<body><script>\n  const target = new URLSearchParams(location.search).get(\'target\') || \'http://127.0.0.1:8080/\';\n  location.replace(target);\n</script></body></html>\n';
const GAME_URL = 'http://127.0.0.1:8080/';
const SHOT_FILES = { 1: '1-start.jpg', 2: '2-drive.jpg', 3: '3-chase.jpg', 4: '4-victory.jpg' };
const MAX_BYTES = 262144;

function ensureBridgeFiles() {
  if (!existsSync(POLICY) || readFileSync(POLICY, 'utf8') !== POLICY_CONTENT) {
    writeFileSync(POLICY, POLICY_CONTENT);
  }
  if (!existsSync(BRIDGE)) writeFileSync(BRIDGE, BRIDGE_CONTENT);
  return createHash('sha256').update(readFileSync(POLICY)).digest('hex');
}

function runPy(args) {
  return new Promise((resolve, reject) => {
    execFile('python3', args, { cwd: ROOT }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

async function waitServer(url, timeoutMs = 20000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - start > timeoutMs) throw new Error('serve.ts did not come up');
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function main() {
  const onlyShot = process.argv[2] ? Number(process.argv[2]) : null;
  const shotList = onlyShot ? [onlyShot] : [1, 2, 3, 4];
  const policySha = ensureBridgeFiles();
  mkdirSync(TMP_DIR, { recursive: true });
  mkdirSync(SHOTS_DIR, { recursive: true });

  const server = spawn('node', ['serve.ts', '--port', '8080'], { cwd: ROOT, stdio: 'ignore' });
  let browser;
  const results = { shots: {}, map: null, errors: [] };
  try {
    await waitServer(GAME_URL);
    browser = await chromium.launch({
      executablePath: '/opt/meta-chromium/chrome',
      headless: true,
      args: [
        '--no-sandbox', '--disable-gpu', '--use-angle=swiftshader-webgl',
        '--enable-unsafe-swiftshader',
        `--hatch-webgl-allowed-domains-file=${POLICY}`,
        `--hatch-webgl-allowed-domains-sha256=${policySha}`,
      ],
    });

    for (const n of shotList) {
      const errors = [];
      const failed = [];
      const external = [];
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720, deviceScaleFactor: 2 },
      });
      const page = await context.newPage();
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('requestfailed', (r) => failed.push(r.url()));
      page.on('request', (r) => {
        const u = r.url();
        if (!u.startsWith(GAME_URL) && !u.startsWith('data:') && !u.startsWith('file://')) external.push(u);
      });
      await page.goto(`${'file://' + BRIDGE}?target=${encodeURIComponent(GAME_URL)}`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(GAME_URL, { timeout: 15000 });
      await page.waitForFunction(() => window.__playerReady === true, null, { timeout: 180000 });
      await page.evaluate(async (num) => window.__pelabuhan.stageShot(num), n);
      await page.waitForTimeout(900); // one frozen frame settles
      const assertion = await page.evaluate((num) => window.__pelabuhan.assertShot(num), n);
      const png = join(TMP_DIR, `shot-${n}.png`);
      await page.screenshot({ path: png, type: 'png' });
      await context.close();

      // Downscale to 1280x720 JPEG; step the quality down until < 256 KiB.
      let stat = null;
      for (const q of [82, 75, 68, 60]) {
        const out = await runPy([join(ROOT, 'tests', 'measure-shots.py'), png, join(SHOTS_DIR, SHOT_FILES[n]), String(q)]);
        stat = JSON.parse(out);
        if (stat.bytes <= MAX_BYTES) break;
      }
      const failedChecks = Object.entries(assertion.checks)
        .filter(([, c]) => !c.ok).map(([k]) => k);
      results.shots[n] = {
        file: SHOT_FILES[n], bytes: stat.bytes, quality: 'see measure',
        mean_brightness: stat.mean_brightness, vivid_fraction: stat.vivid_fraction,
        unique_colors_320: stat.unique_colors_320,
        assertion, failedChecks,
        consoleErrors: errors, failedRequests: failed, externalRequests: external,
      };
      console.log(`shot ${n} ${SHOT_FILES[n]}: ${stat.bytes} B, brightness ${stat.mean_brightness}, `
        + `failed checks [${failedChecks.join(', ') || 'none'}], console errors ${errors.length}`);
      if (failedChecks.length) console.log('  assertion:', JSON.stringify(assertion, null, 1));
      if (errors.length) console.log('  console errors:', JSON.stringify(errors));
    }

    // City-map check: 5 jobs, a drawn map (districts live on the canvas,
    // not in DOM text), stats. Skipped in single-shot mode.
    if (!onlyShot) {
      const errors = [];
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await context.newPage();
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${'file://' + BRIDGE}?target=${encodeURIComponent(GAME_URL)}`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(GAME_URL, { timeout: 15000 });
      await page.waitForFunction(() => window.__playerReady === true, null, { timeout: 180000 });
      await page.evaluate(() => window.__pelabuhan.startGame('NORMAL'));
      await page.waitForTimeout(600);
      await page.keyboard.press('KeyM');
      await page.waitForSelector('.hud-map', { state: 'visible', timeout: 10000 });
      const map = await page.evaluate(() => {
        const canvas = document.querySelector('.hud-map canvas');
        const g = canvas.getContext('2d');
        const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = 0;
        for (let i = 0; i < data.length; i += 16) {
          if (data[i] !== 0x12 || data[i + 1] !== 0x08 || data[i + 2] !== 0x1f) painted += 1;
        }
        return {
          jobs: document.querySelectorAll('.hud-map-job').length,
          paintedPixels: painted,
          title: document.querySelector('.hud-map-title').textContent,
          stats: document.querySelector('.hud-map-stats').textContent,
        };
      });
      results.map = {
        jobs: map.jobs,
        paintedPixels: map.paintedPixels,
        title: map.title,
        stats: map.stats.replace(/\s+/g, ' ').trim(),
        consoleErrors: errors,
      };
      console.log(`map: ${map.jobs} jobs, painted px ${map.paintedPixels}, errors ${errors.length}`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }

  const bad = [];
  for (const [n, r] of Object.entries(results.shots)) {
    if (r.failedChecks.length) bad.push(`shot ${n} checks: ${r.failedChecks.join(', ')}`);
    if (r.bytes > MAX_BYTES) bad.push(`shot ${n} oversize ${r.bytes}`);
    if (r.consoleErrors.length) bad.push(`shot ${n} console errors: ${r.consoleErrors.join(' | ')}`);
    if (r.failedRequests.length) bad.push(`shot ${n} failed requests: ${r.failedRequests.join(', ')}`);
    if (r.externalRequests.length) bad.push(`shot ${n} external requests: ${r.externalRequests.join(', ')}`);
  }
  if (!onlyShot) {
    if (!results.map || results.map.jobs !== 5) bad.push(`map jobs ${results.map?.jobs}`);
    if (!results.map || results.map.paintedPixels < 1000) bad.push(`map canvas blank (${results.map?.paintedPixels})`);
    if (results.map?.consoleErrors.length) bad.push(`map console errors: ${results.map.consoleErrors.join(' | ')}`);
  }
  if (bad.length) {
    console.log('\nFAILED:\n- ' + bad.join('\n- '));
    process.exit(1);
  }
  console.log(onlyShot
    ? `\nShot ${onlyShot} PASS, 0 console errors, 0 failed requests, 0 external requests`
    : '\nPlaywright 4/4 PASS + map check PASS, 0 console errors, 0 failed requests, 0 external requests');
}

main().catch((err) => { console.error(err); process.exit(1); });
