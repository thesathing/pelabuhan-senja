// PELABUHAN SENJA — part 1 world contracts (Node, no browser needed).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEED, WORLD_WIDTH, WORLD_DEPTH, LIGHTHOUSE, ROADS, DISTRICTS,
  BUILDING_TARGET, NEON_SIGNS, SCATTER_COUNTS, DRESSING_COUNTS, DIRT_PATHS,
  buildWorldData, heightAt, slopeAt, districtAt, roadDistance, isOnRoad,
} from '../game/world-data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

describe('heightfield', () => {
  it('is 300x280 with a 31-high lighthouse hill', () => {
    assert.equal(WORLD_WIDTH, 300);
    assert.equal(WORLD_DEPTH, 280);
    const peak = heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z);
    assert.ok(peak > 29 && peak <= 32, `lighthouse peak ${peak}`);
    // The peak is the local maximum around the hill.
    for (const [dx, dz] of [[20, 0], [-20, 0], [0, 20], [0, -20]]) {
      assert.ok(heightAt(LIGHTHOUSE.x + dx, LIGHTHOUSE.z + dz) < peak);
    }
  });

  it('falls to sea on the east edge and stays finite everywhere', () => {
    assert.ok(heightAt(148, 0) < 0, 'east edge is sea');
    assert.ok(heightAt(148, -100) < 0, 'north-east is sea');
    assert.ok(heightAt(95, 85) < 0, 'harbor basin is water');
    assert.ok(heightAt(0, 0) > 0, 'city centre is land');
    for (let x = -150; x <= 150; x += 15) {
      for (let z = -140; z <= 140; z += 14) {
        const h = heightAt(x, z);
        assert.ok(Number.isFinite(h), `height at ${x},${z}`);
        assert.ok(h > -10 && h < 40, `height ${h} at ${x},${z}`);
      }
    }
  });

  it('is deterministic for the fixed seed', () => {
    const a = buildWorldData(SEED);
    const b = buildWorldData(SEED);
    assert.deepEqual(a, b);
    const c = buildWorldData(SEED + 1);
    assert.notDeepEqual(a.buildings, c.buildings);
  });
});

describe('roads and districts', () => {
  it('has 9 road segments including the avenue and the hill road', () => {
    assert.equal(ROADS.length, 9);
    assert.ok(ROADS.some((r) => r.name === 'avenue'));
    assert.ok(ROADS.some((r) => r.name === 'hill'));
    assert.ok(isOnRoad(0, 0), 'avenue centre is road');
    assert.ok(!isOnRoad(25, 25), 'a block interior is not road');
    assert.ok(roadDistance(25, 25) > 2, 'blocks clear the roads');
  });

  it('has exactly 6 districts that tile the map', () => {
    assert.equal(DISTRICTS.length, 6);
    assert.deepEqual(
      DISTRICTS.map((d) => d.name).sort(),
      ['DERMAGA', 'OLD TOWN', 'PASAR SENJA', 'PERGUDANGAN', 'TANJUNG API', 'THE HARBOR'].sort(),
    );
    for (let x = -150; x <= 150; x += 10) {
      for (let z = -140; z <= 140; z += 10) {
        assert.ok(DISTRICTS.some((d) => d.name === districtAt(x, z)));
      }
    }
  });
});

describe('buildings', () => {
  const data = buildWorldData(SEED);

  it('places ~45 road-aware buildings, none on a road or in water', () => {
    assert.ok(data.buildings.length >= 40 && data.buildings.length <= BUILDING_TARGET,
      `count ${data.buildings.length}`);
    for (const b of data.buildings) {
      assert.ok(roadDistance(b.x, b.z) >= 2, `building at ${b.x},${b.z} clears roads`);
      assert.ok(heightAt(b.x, b.z) > 0.6, 'building stands on land');
      assert.ok(Math.hypot(b.x - LIGHTHOUSE.x, b.z - LIGHTHOUSE.z) >= 36, 'hilltop kept clear');
      assert.ok(b.w >= 10 && b.w <= 22 && b.d >= 10 && b.d <= 20, 'sane footprint');
      assert.ok(b.h >= 8 && b.h <= 34, 'sane height');
      assert.ok(DISTRICTS.some((d) => d.name === b.district), 'has a district');
    }
  });

  it('assigns all 5 neon signs to distinct buildings', () => {
    const signed = data.buildings.filter((b) => b.sign);
    assert.equal(signed.length, NEON_SIGNS.length);
    assert.deepEqual(
      signed.map((b) => b.sign).sort(),
      NEON_SIGNS.map((s) => s.text).sort(),
    );
  });
});

describe('terrain scatter and dressing', () => {
  const data = buildWorldData(SEED);

  it('has the specified scatter counts', () => {
    assert.equal(data.scatter.grass.length, SCATTER_COUNTS.grass);
    assert.equal(data.scatter.rocks.length, SCATTER_COUNTS.rocks);
    assert.equal(data.scatter.palms.length, SCATTER_COUNTS.palms);
    assert.ok(data.scatter.shrubs.length > 100, 'shrubs present');
    assert.ok(data.scatter.flowers.length > 80, 'flowers present');
  });

  it('keeps grass and palms off roads and out of water', () => {
    for (const g of data.scatter.grass) {
      assert.ok(!isOnRoad(g.x, g.z), 'grass off road');
      assert.ok(heightAt(g.x, g.z) > 0.3, 'grass on land');
    }
    for (const p of data.scatter.palms) {
      assert.ok(roadDistance(p.x, p.z) >= 5, 'palms clear the road');
      assert.ok(heightAt(p.x, p.z) > 0.3, 'palms on land');
    }
  });

  it('has the specified dressing counts, on the roads', () => {
    assert.equal(data.dressing.cracks.length, DRESSING_COUNTS.cracks);
    assert.equal(data.dressing.patches.length, DRESSING_COUNTS.patches);
    assert.equal(data.dressing.puddles.length, DRESSING_COUNTS.puddles);
    assert.equal(data.paths.length, DIRT_PATHS.length);
    assert.equal(data.paths.length, 3);
    for (const c of [...data.dressing.cracks, ...data.dressing.patches, ...data.dressing.puddles]) {
      assert.ok(isOnRoad(c.x, c.z, 2.5), 'dressing sits on a road');
    }
    assert.ok(data.dressing.curbs.length > 100, 'curbs line the roads');
  });
});

describe('vendoring, license and wallet', () => {
  it('vendors three.js 0.187.0 with a direct core import', () => {
    assert.ok(existsSync(join(root, 'game/vendor/three.core.min.js')));
    assert.ok(existsSync(join(root, 'game/vendor/three.module.min.js')));
    const mod = read('game/vendor/three.module.min.js');
    assert.ok(/from\s+['"]\.\/three\.core\.min\.js['"]/.test(mod),
      'module imports ./three.core.min.js directly');
    assert.ok(!/from\s+['"]\.\/three\.core\.js['"]/.test(mod),
      'no reference to a nonexistent three.core.js');
    const core = read('game/vendor/three.core.min.js');
    assert.ok(core.includes('three@0.187.0'), 'three 0.187.0');
  });

  it('loads the game with no import map and no external reference', () => {
    const html = read('game/index.html');
    assert.ok(!html.includes('importmap'), 'no import map');
    assert.ok(html.includes('<script type="module" src="./main.js">'), 'loads main.js');
    const main = read('game/main.js');
    assert.ok(main.includes("from './vendor/three.module.min.js'"), 'main imports vendored three');
    assert.ok(!/https?:\/\//.test(main), 'main.js has no network URL');
  });

  it('keeps the SPDX license line and the exact payout wallet', () => {
    assert.ok(read('LICENSE').startsWith('SPDX-License-Identifier: MIT'));
    const owner = JSON.parse(read('.makefun/owner.json'));
    assert.equal(owner.wallet, 'DH3JqLcf8bKJWabY6HPfBtPZsjDkQgCbbX1WkjLvQSxu');
  });

  it('has no referral code anywhere in the part-1 tree', () => {
    for (const p of ['game/main.js', 'game/world.js', 'game/world-data.js', 'game/scene-detail.js', 'package.json', 'DESIGN.md']) {
      assert.ok(!/referral|utm_source|wftbn3z4/i.test(read(p)), `${p} is referral-free`);
    }
  });
});
