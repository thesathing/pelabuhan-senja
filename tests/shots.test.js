// PELABUHAN SENJA — part-4 tests: shot specs, screenshot files, README
// badges, untouched plumbing, staging wiring. The live capture (Playwright
// 4/4 + raycast assertions + map check) runs in tests/capture-shots.mjs.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { SHOT_SPECS, ndcInFrame, boxesDisjoint } from '../game/shot-staging.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const BADGES = [
  '[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)',
  '[![rank](https://make.fun/badge/gta6-01/thesathing/pelabuhan-senja/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)',
  '[![reward](https://make.fun/badge/gta6-01/thesathing/pelabuhan-senja/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)',
];

// Minimal JPEG dimension reader (SOF0/SOF2): no image library in Node.
function jpegSize(buf) {
  assert.equal(buf[0], 0xff, 'JPEG SOI');
  assert.equal(buf[1], 0xd8, 'JPEG SOI');
  let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    }
    i += 2 + len;
  }
  throw new Error('no JPEG SOF marker found');
}

describe('shot specs', () => {
  it('defines exactly 4 shots with the right files and FOVs', () => {
    assert.equal(SHOT_SPECS.length, 4);
    assert.deepEqual(SHOT_SPECS.map((s) => s.file),
      ['1-start.jpg', '2-drive.jpg', '3-chase.jpg', '4-victory.jpg']);
    assert.deepEqual(SHOT_SPECS.map((s) => s.fov), [57, 40, 55, 57]);
    for (const s of SHOT_SPECS) assert.ok(s.desc.length > 10, `${s.file} has a description`);
  });

  it('shots.json lists exactly the 4 real shots', () => {
    const shots = JSON.parse(read('shots.json'));
    assert.deepEqual(shots.map((s) => s.name), SHOT_SPECS.map((s) => s.file));
  });

  it('ndcInFrame / boxesDisjoint behave', () => {
    assert.ok(ndcInFrame({ x: 0.5, y: -0.5, z: 0.2 }));
    assert.ok(!ndcInFrame({ x: 0.95, y: 0, z: 0 }));
    assert.ok(boxesDisjoint({ x: -0.5, y: 0, w: 0.3, h: 0.2 }, { x: 0.5, y: 0, w: 0.3, h: 0.2 }));
    assert.ok(!boxesDisjoint({ x: 0, y: 0, w: 0.5, h: 0.2 }, { x: 0.2, y: 0, w: 0.5, h: 0.2 }));
  });
});

describe('screenshot files', () => {
  it('all 4 are real 1280x720 JPEGs under 256 KiB', () => {
    for (const s of SHOT_SPECS) {
      const p = join(ROOT, 'screenshots', s.file);
      assert.ok(existsSync(p), `${s.file} exists`);
      const buf = readFileSync(p);
      assert.ok(buf.length <= 262144, `${s.file} is ${buf.length} B (max 262144)`);
      assert.deepEqual(jpegSize(buf), { width: 1280, height: 720 }, `${s.file} is 1280x720`);
    }
  });
});

describe('README and plumbing', () => {
  it('README starts with exactly the three live make.fun badges', () => {
    const lines = read('README.md').split('\n');
    assert.deepEqual(lines.slice(0, 3), BADGES);
  });

  it('README has a run section and no claim/referral code', () => {
    const md = read('README.md');
    assert.ok(md.includes('node serve.ts'), 'run section names node serve.ts');
    assert.ok(md.includes('http://localhost:8080'), 'run section names the URL');
    assert.ok(!/wftbn3z4/i.test(md), 'no referral code in README');
  });

  it('main.ts / serve.ts / vendor/makefun-game.ts are byte-identical to the kit starter', () => {
    for (const f of ['main.ts', 'serve.ts', 'vendor/makefun-game.ts']) {
      const mine = readFileSync(join(ROOT, f));
      const kit = readFileSync(join(ROOT, '..', 'gta6-01-kit', 'starter', f));
      assert.ok(mine.equals(kit), `${f} is untouched from the starter`);
    }
  });

  it('main.js imports shot-staging and exposes stage + assert handles', () => {
    const main = read('game/main.js');
    assert.ok(main.includes("from './shot-staging.js'"), 'imports shot-staging');
    assert.ok(main.includes('stageShot'), 'exposes stageShot');
    assert.ok(main.includes('assertShot'), 'exposes assertShot');
    assert.ok(main.includes('setLightBarsHot'), 'light-bar staging exists');
    assert.ok(!/https?:\/\//.test(read('game/shot-staging.js')), 'staging has no network URL');
  });

  it('has no referral code in the new part-4 files', () => {
    for (const p of ['game/shot-staging.js', 'tests/capture-shots.mjs', 'tests/measure-shots.py', 'game/style.css']) {
      assert.ok(!/referral|utm_source|wftbn3z4/i.test(read(p)), `${p} is referral-free`);
    }
  });
});
