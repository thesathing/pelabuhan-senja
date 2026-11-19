// PELABUHAN SENJA — pure world data (no three.js import, Node-testable).
// Everything the scene builder needs is derived here from one fixed seed, so the
// city is identical on every load. The three.js scene builder (world.js and
// scene-detail.js) only turns this data into meshes.

export const SEED = 20261118;
export const WORLD_WIDTH = 300; // x: -150..150
export const WORLD_DEPTH = 280; // z: -140..140
export const LIGHTHOUSE = { x: 105, z: -95, peak: 31 };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Distance from a point to an axis-aligned or diagonal segment.
export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / len2;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t, cz = az + dz * t;
  return Math.hypot(px - cx, pz - cz);
}

// --- Roads: axis-aligned avenues and cross streets, a harbor ring and a hill road.
export const ROADS = [
  { ax: -140, az: 0, bx: 120, bz: 0, w: 9, name: 'avenue' },
  { ax: -100, az: -120, bx: -100, bz: 120, w: 8, name: 'cross' },
  { ax: -50, az: -120, bx: -50, bz: 120, w: 8, name: 'cross' },
  { ax: 0, az: -120, bx: 0, bz: 120, w: 8, name: 'cross' },
  { ax: 50, az: -120, bx: 50, bz: 120, w: 8, name: 'cross' },
  { ax: 100, az: -120, bx: 100, bz: 120, w: 8, name: 'cross' },
  { ax: 45, az: 40, bx: 140, bz: 40, w: 7, name: 'harbor' },
  { ax: 45, az: 40, bx: 45, bz: 130, w: 7, name: 'harbor' },
  { ax: 55, az: -35, bx: 100, bz: -88, w: 6, name: 'hill' },
];

export function roadDistance(x, z) {
  let best = Infinity;
  for (const r of ROADS) {
    const d = distToSegment(x, z, r.ax, r.az, r.bx, r.bz) - r.w / 2;
    if (d < best) best = d;
  }
  return best;
}
export function isOnRoad(x, z, margin = 0) {
  return roadDistance(x, z) <= margin;
}

// --- Districts: rectangles that tile the map.
export const DISTRICTS = [
  { name: 'OLD TOWN', rects: [[-150, -140, -30, -30]] },
  { name: 'TANJUNG API', rects: [[-30, -140, 150, -30]] },
  { name: 'PASAR SENJA', rects: [[-150, -30, -30, 60]] },
  { name: 'DERMAGA', rects: [[-30, -30, 60, 60], [-150, 60, -30, 140]] },
  { name: 'THE HARBOR', rects: [[60, -30, 150, 140]] },
  { name: 'PERGUDANGAN', rects: [[-30, 60, 60, 140]] },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    for (const [x1, z1, x2, z2] of d.rects) {
      if (x >= x1 && x <= x2 && z >= z1 && z <= z2) return d.name;
    }
  }
  return 'DERMAGA';
}

// --- Heightfield: sine hills + lighthouse hill + coast slope + harbor basin.
function heightRaw(x, z) {
  let h = 3.6 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05 - 0.7)
    + 2.2 * Math.sin(x * 0.11 - 0.4) * Math.sin(z * 0.09 + 2.1)
    + 1.1 * Math.sin((x + z) * 0.021 + 0.5);
  const dx = x - LIGHTHOUSE.x, dz = z - LIGHTHOUSE.z;
  h += LIGHTHOUSE.peak * Math.exp(-(dx * dx + dz * dz) / (2 * 26 * 26));
  const coast = smoothstep(100, 140, x);
  h = h * (1 - coast) + (-6) * coast;
  // Harbor basin: an ellipse of water south-east of the harbor road.
  const ex = (x - 95) / 42, ez = (z - 85) / 32;
  const e = ex * ex + ez * ez;
  const b = smoothstep(1.15, 0.75, e);
  if (b > 0) h = h * (1 - b) + (-2.5 + 2.0 * e) * b;
  return h;
}

function nearestRoadPoint(x, z) {
  let best = Infinity, bx = x, bz = z;
  for (const r of ROADS) {
    const dx = r.bx - r.ax, dz = r.bz - r.az;
    const len2 = dx * dx + dz * dz;
    let t = len2 === 0 ? 0 : ((x - r.ax) * dx + (z - r.az) * dz) / len2;
    t = clamp(t, 0, 1);
    const cx = r.ax + dx * t, cz = r.az + dz * t;
    const d = Math.hypot(x - cx, z - cz);
    if (d < best) { best = d; bx = cx; bz = cz; }
  }
  return { d: best, x: bx, z: bz };
}

// Roads are flattened: near a road the ground eases to the road's own height,
// so road ribbons never clip through hills.
export function heightAt(x, z) {
  const h = heightRaw(x, z);
  const near = nearestRoadPoint(x, z);
  const road = ROADS.reduce((best, r) => {
    const d = distToSegment(x, z, r.ax, r.az, r.bx, r.bz);
    return d < best.d ? { d, w: r.w } : best;
  }, { d: Infinity, w: 8 });
  const t = smoothstep(road.w / 2 + 2, road.w / 2 - 1, near.d);
  if (t <= 0) return h;
  return lerp(h, heightRaw(near.x, near.z), t);
}

export function slopeAt(x, z) {
  const e = 1.5;
  const gx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
  const gz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  return Math.hypot(gx, gz);
}

// --- Buildings: rejection-sampled, never on a road, never in water, never
// on the lighthouse hilltop, with a gap between neighbours.
export const BUILDING_TARGET = 45;
export const NEON_SIGNS = [
  { text: 'MARKET', anchor: { x: -80, z: 10 } },
  { text: 'HARBOUR CAFE', anchor: { x: 90, z: 60 } },
  { text: 'FISH STALL', anchor: { x: 70, z: 100 } },
  { text: 'BOAT SUPPLY', anchor: { x: 110, z: 45 } },
  { text: 'ANCHOR BAR', anchor: { x: -60, z: -60 } },
];
export const FACADES = [
  0x9a6b5f, // dusty rose
  0xb08a4f, // ochre
  0x5f7a72, // teal gray
  0xa89878, // sand
  0x5a6b8a, // slate blue
  0x8a4f3d, // brick
];

function buildingsOverlap(a, b, gap) {
  const dx = Math.abs(a.x - b.x) - (a.w + b.w) / 2;
  const dz = Math.abs(a.z - b.z) - (a.d + b.d) / 2;
  return dx < gap && dz < gap;
}

export function generateBuildings(random) {
  const list = [];
  let tries = 0;
  while (list.length < BUILDING_TARGET && tries < 6000) {
    tries += 1;
    const x = -145 + random() * 290;
    const z = -135 + random() * 270;
    if (roadDistance(x, z) < 2) continue;
    if (heightAt(x, z) < 0.6) continue;
    if (Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z) < 36) continue;
    const w = 10 + random() * 12;
    const d = 10 + random() * 10;
    const nearCenter = Math.hypot(x, z) < 60;
    const h = nearCenter ? 14 + random() * 20 : 8 + random() * 14;
    const cand = {
      x, z, w, d, h,
      rot: random() < 0.5 ? 0 : Math.PI / 2,
      district: districtAt(x, z),
      facade: Math.floor(random() * FACADES.length),
      floors: Math.max(2, Math.round(h / 3.4)),
      sign: null,
    };
    if (list.some((b) => buildingsOverlap(cand, b, 3))) continue;
    list.push(cand);
  }
  // Neon signs: the building nearest each anchor gets that sign; each
  // building takes at most one sign.
  for (const s of NEON_SIGNS) {
    let best = null, bestD = Infinity;
    for (const b of list) {
      if (b.sign) continue;
      const d = Math.hypot(b.x - s.anchor.x, b.z - s.anchor.z);
      if (d < bestD) { bestD = d; best = b; }
    }
    if (best) best.sign = s.text;
  }
  return list;
}

// --- Terrain scatter + road dressing, all seeded.
export const SCATTER_COUNTS = { grass: 1600, shrubs: 140, flowers: 120, rocks: 220, palms: 95 };
export const DRESSING_COUNTS = { cracks: 14, patches: 7, puddles: 7, manholes: 12, drains: 10, oil: 10 };
export const DIRT_PATHS = [
  [[-120, 110], [-70, 95], [-30, 100], [15, 92]],
  [[-90, -110], [-40, -90], [10, -100], [55, -80]],
  [[30, 120], [45, 90], [40, 60], [60, 35]],
];
export const GRASS_GREENS = [0x4a7a3a, 0x5d8a3f, 0x3d6b34];

function randomLandPoint(random, opts = {}) {
  for (let i = 0; i < 40; i += 1) {
    const x = -148 + random() * 296;
    const z = -138 + random() * 276;
    const h = heightAt(x, z);
    if (h < (opts.minH ?? 0.4)) continue;
    if (h > (opts.maxH ?? 14)) continue;
    if (roadDistance(x, z) < (opts.roadClear ?? 1)) continue;
    if (slopeAt(x, z) > (opts.maxSlope ?? 0.9)) continue;
    return { x, z, h };
  }
  return null;
}

function randomRoadPoint(random, lateralMax) {
  const r = ROADS[Math.floor(random() * ROADS.length)];
  const t = 0.05 + random() * 0.9;
  const x = lerp(r.ax, r.bx, t) + (random() - 0.5) * 2 * lateralMax;
  const z = lerp(r.az, r.bz, t) + (random() - 0.5) * 2 * lateralMax;
  const angle = Math.atan2(r.bz - r.az, r.bx - r.ax);
  return { x, z, h: heightAt(x, z), angle, road: r };
}

export function generateScatter(random) {
  const grass = [];
  for (let i = 0; i < SCATTER_COUNTS.grass; i += 1) {
    const p = randomLandPoint(random, { maxH: 12 });
    if (p) grass.push({ ...p, s: 0.5 + random() * 0.6, rot: random() * Math.PI, green: GRASS_GREENS[Math.floor(random() * 3)] });
  }
  const shrubs = [];
  for (let i = 0; i < SCATTER_COUNTS.shrubs; i += 1) {
    const p = randomLandPoint(random, { maxH: 13 });
    if (p) shrubs.push({ ...p, s: 0.6 + random() * 0.9, rot: random() * Math.PI });
  }
  const flowers = [];
  for (let i = 0; i < SCATTER_COUNTS.flowers; i += 1) {
    const p = randomLandPoint(random, { maxH: 8 });
    if (p) flowers.push({ ...p, s: 0.5 + random() * 0.5, rot: random() * Math.PI, color: [0xe86a92, 0xf2c14e, 0xf5f0e6][Math.floor(random() * 3)] });
  }
  const rocks = [];
  for (let i = 0; i < SCATTER_COUNTS.rocks; i += 1) {
    const p = randomLandPoint(random, { maxH: 30, maxSlope: 1.6, roadClear: 0.5 });
    if (p) rocks.push({ ...p, s: 0.3 + random() * 1.1, rot: random() * Math.PI });
  }
  const palms = [];
  let palmTries = 0;
  while (palms.length < SCATTER_COUNTS.palms && palmTries < 3000) {
    palmTries += 1;
    const x = -145 + random() * 290;
    const z = -135 + random() * 270;
    const h = heightAt(x, z);
    if (h < 0.4 || h > 10) continue;
    const nearRoad = roadDistance(x, z) < 12;
    const nearCoast = x > 80 || Math.hypot(x - 95, z - 85) < 55;
    if (!nearRoad && !nearCoast) continue;
    if (roadDistance(x, z) < 5.5) continue;
    if (slopeAt(x, z) > 0.7) continue;
    palms.push({ x, z, h, s: 0.8 + random() * 0.5, rot: random() * Math.PI });
  }
  return { grass, shrubs, flowers, rocks, palms };
}

export function generateDressing(random) {
  const cracks = [];
  for (let i = 0; i < DRESSING_COUNTS.cracks; i += 1) {
    const p = randomRoadPoint(random, 2.5);
    cracks.push({ ...p, len: 1.5 + random() * 2.5, w: 0.08 + random() * 0.1 });
  }
  const patches = [];
  for (let i = 0; i < DRESSING_COUNTS.patches; i += 1) {
    const p = randomRoadPoint(random, 2);
    patches.push({ ...p, len: 2 + random() * 2, w: 1.5 + random() * 1.5 });
  }
  const puddles = [];
  for (let i = 0; i < DRESSING_COUNTS.puddles; i += 1) {
    const p = randomRoadPoint(random, 3);
    puddles.push({ ...p, r: 1.2 + random() * 1.0 });
  }
  const manholes = [];
  for (let i = 0; i < DRESSING_COUNTS.manholes; i += 1) {
    const p = randomRoadPoint(random, 2.5);
    manholes.push({ ...p, r: 0.55 });
  }
  const drains = [];
  for (let i = 0; i < DRESSING_COUNTS.drains; i += 1) {
    const p = randomRoadPoint(random, 3.2);
    drains.push({ ...p, len: 1.2, w: 0.35 });
  }
  const oil = [];
  for (let i = 0; i < DRESSING_COUNTS.oil; i += 1) {
    const p = randomRoadPoint(random, 2.5);
    oil.push({ ...p, r: 0.8 + random() * 1.2 });
  }
  // Curbs: short boxes strung along both edges of every road.
  const curbs = [];
  for (const r of ROADS) {
    const len = Math.hypot(r.bx - r.ax, r.bz - r.az);
    const angle = Math.atan2(r.bz - r.az, r.bx - r.ax);
    const nx = Math.sin(angle), nz = -Math.cos(angle);
    const steps = Math.floor(len / 4);
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      for (const side of [-1, 1]) {
        const x = lerp(r.ax, r.bx, t) + nx * side * (r.w / 2 + 0.35);
        const z = lerp(r.az, r.bz, t) + nz * side * (r.w / 2 + 0.35);
        curbs.push({ x, z, h: heightAt(x, z), angle, len: 3.9 });
      }
    }
  }
  return { cracks, patches, puddles, manholes, drains, oil, curbs };
}

// One call builds everything; the scene builder consumes this object.
export function buildWorldData(seed = SEED) {
  const random = mulberry32(seed);
  const buildings = generateBuildings(random);
  const scatter = generateScatter(random);
  const dressing = generateDressing(random);
  return { seed, buildings, scatter, dressing, paths: DIRT_PATHS };
}

export const WORLD_DATA = buildWorldData(SEED);
