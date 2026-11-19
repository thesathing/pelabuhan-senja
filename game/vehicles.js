// PELABUHAN SENJA — three.js vehicle builders (part 2).
// Car local axes: forward +Z, width X, up Y, ground at y = 0. A group with
// rotation.y = heading faces (sin(heading), 0, cos(heading)), matching driving.js.
// The GT coupe is an open tub: roof rails + glass but NO roof panel over the
// driver, so Raka stays visible through the glasshouse and from above.
import * as THREE from './vendor/three.module.min.js';
import { COUPE, CONVERTIBLE, INTERCEPTOR, TRUCK } from './vehicle-data.js';

const M = {
  tire: new THREE.MeshStandardMaterial({ color: 0x0e0e12, roughness: 0.95 }),
  hub: new THREE.MeshStandardMaterial({ color: 0xcfd2d8, metalness: 0.85, roughness: 0.25 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.6, metalness: 0.2 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd8dce2, metalness: 0.9, roughness: 0.2 }),
  plate: new THREE.MeshStandardMaterial({ color: 0xf2f2e8, roughness: 0.5 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x2a2233, roughness: 0.9 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.7 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.9 }),
  shirt: new THREE.MeshStandardMaterial({ color: 0x2a6fd8, roughness: 0.8 }),
  pants: new THREE.MeshStandardMaterial({ color: 0x2e2a33, roughness: 0.9 }),
};

function paint(color) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.32 });
}
function box(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function led(color, intensity = 2.2) {
  return new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
}
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
let glowTexCache = null;
function getGlowTexture() {
  if (!glowTexCache) glowTexCache = glowTexture();
  return glowTexCache;
}

// One wheel: torus tire + hub disc + 5 spokes. The spinner rotates around X
// (the axle) to roll; the pivot rotates around Y to steer (front wheels).
export function buildWheel(radius) {
  const pivot = new THREE.Group();
  const spinner = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.34, 10, 20), M.tire);
  tire.rotation.y = Math.PI / 2; // torus plane -> YZ, axle along X
  tire.castShadow = true;
  spinner.add(tire);
  const hub = cyl(radius * 0.55, radius * 0.55, 0.08, M.hub);
  hub.rotation.z = Math.PI / 2;
  spinner.add(hub);
  for (let i = 0; i < 5; i += 1) {
    const spoke = box(0.06, radius * 0.95, 0.05, M.hub, 0, 0, 0, 0, 0, (i / 5) * Math.PI);
    spoke.position.set(0, 0, 0);
    spinner.add(spoke);
  }
  pivot.add(spinner);
  return { pivot, spinner };
}

// Seated driver: torso, head, arms reaching to the wheel, bent legs.
// x is the lateral seat offset (negative = left seat).
export function buildDriver(seatX = -0.38, shirtMat = M.shirt) {
  const g = new THREE.Group();
  const torso = box(0.42, 0.52, 0.26, shirtMat, 0, 0.62, 0);
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), M.skin);
  head.position.set(0, 1.02, 0.02);
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair);
  hair.position.set(0, 1.05, -0.01);
  g.add(hair);
  // Arms forward-down to the steering wheel.
  g.add(box(0.11, 0.11, 0.5, shirtMat, -0.24, 0.78, 0.22, 0.5));
  g.add(box(0.11, 0.11, 0.5, shirtMat, 0.24, 0.78, 0.22, 0.5));
  // Legs: thighs forward, shins down to the pedals.
  g.add(box(0.15, 0.15, 0.42, M.pants, -0.12, 0.42, 0.24));
  g.add(box(0.15, 0.15, 0.42, M.pants, 0.12, 0.42, 0.24));
  g.add(box(0.14, 0.4, 0.14, M.pants, -0.12, 0.2, 0.44));
  g.add(box(0.14, 0.4, 0.14, M.pants, 0.12, 0.2, 0.44));
  g.position.set(seatX, 0, 0);
  return g;
}

// Standing Raka for on-foot mode: pivoted limbs for the leg-swing walk.
export function buildRaka() {
  const g = new THREE.Group();
  const mkLimb = (w, h, d, mat, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = box(w, h, d, mat, 0, -h / 2, 0);
    pivot.add(m);
    g.add(pivot);
    return pivot;
  };
  const legL = mkLimb(0.16, 0.8, 0.18, M.pants, -0.12, 0.82);
  const legR = mkLimb(0.16, 0.8, 0.18, M.pants, 0.12, 0.82);
  const torso = box(0.46, 0.58, 0.28, M.shirt, 0, 1.12, 0);
  g.add(torso);
  const armL = mkLimb(0.12, 0.62, 0.14, M.shirt, -0.3, 1.36);
  const armR = mkLimb(0.12, 0.62, 0.14, M.shirt, 0.3, 1.36);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), M.skin);
  head.position.set(0, 1.58, 0);
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair);
  hair.position.set(0, 1.61, -0.01);
  g.add(hair);
  return { group: g, parts: { legL, legR, armL, armR, head, torso } };
}

function buildCoupeBody(spec, opts = {}) {
  const g = new THREE.Group();
  const paintMat = paint(opts.color ?? spec.color);
  const brakeMat = led(0xff1a2a, 1.4);
  const headMat = led(0xfff2c0, 2.2);

  // Main slab: low, long, slightly rear-biased.
  g.add(box(2.0, 0.42, 4.6, paintMat, 0, 0.55, -0.1));
  // Long sloped hood: front 2.1 of the car, sloping down to the nose.
  g.add(box(1.9, 0.16, 2.1, paintMat, 0, 0.72, 1.55, -0.07));
  // Nose + front bumper.
  g.add(box(2.02, 0.3, 0.35, paintMat, 0, 0.42, 2.5));
  // Splitter: thin blade under the nose.
  g.add(box(2.06, 0.07, 0.55, M.dark, 0, 0.16, 2.45));
  // Side skirts + intakes.
  g.add(box(0.09, 0.14, 3.1, M.dark, -1.0, 0.24, -0.2));
  g.add(box(0.09, 0.14, 3.1, M.dark, 1.0, 0.24, -0.2));
  g.add(box(0.06, 0.22, 0.7, M.dark, -1.01, 0.55, -0.95));
  g.add(box(0.06, 0.22, 0.7, M.dark, 1.01, 0.55, -0.95));
  // Rear deck + diffuser + spoiler.
  g.add(box(1.95, 0.14, 1.3, paintMat, 0, 0.74, -1.95));
  g.add(box(1.9, 0.1, 0.5, M.dark, 0, 0.3, -2.5, 0.35));
  g.add(box(0.08, 0.3, 0.08, M.dark, -0.6, 0.85, -2.4));
  g.add(box(0.08, 0.3, 0.08, M.dark, 0.6, 0.85, -2.4));
  g.add(box(1.85, 0.05, 0.45, paintMat, 0, 1.0, -2.42, -0.06));
  // Hood vents.
  g.add(box(0.3, 0.03, 0.5, M.dark, -0.5, 0.82, 1.7, -0.07));
  g.add(box(0.3, 0.03, 0.5, M.dark, 0.5, 0.82, 1.7, -0.07));
  // Thin LED headlight strips + full-width taillight bar.
  g.add(box(0.55, 0.06, 0.06, headMat, -0.65, 0.68, 2.62));
  g.add(box(0.55, 0.06, 0.06, headMat, 0.65, 0.68, 2.62));
  const tailBar = box(1.9, 0.08, 0.06, brakeMat, 0, 0.72, -2.62);
  g.add(tailBar);
  // Dual exhausts.
  const exL = cyl(0.07, 0.07, 0.22, M.chrome, -0.5, 0.26, -2.62, 8);
  exL.rotation.x = Math.PI / 2;
  const exR = cyl(0.07, 0.07, 0.22, M.chrome, 0.5, 0.26, -2.62, 8);
  exR.rotation.x = Math.PI / 2;
  g.add(exL, exR);
  // Mirrors + plates.
  g.add(box(0.06, 0.16, 0.05, paintMat, -1.06, 0.86, 0.35));
  g.add(box(0.06, 0.16, 0.05, paintMat, 1.06, 0.86, 0.35));
  g.add(box(0.2, 0.1, 0.14, paintMat, -1.04, 0.86, 0.35));
  g.add(box(0.2, 0.1, 0.14, paintMat, 1.04, 0.86, 0.35));
  g.add(box(0.5, 0.14, 0.03, M.plate, 0, 0.42, 2.68));
  g.add(box(0.5, 0.14, 0.03, M.plate, 0, 0.5, -2.68));

  // --- Glasshouse: an OPEN TUB. Roof rails + raked glass, no roof panel,
  // so the driver reads through the glass and from above.
  // Interior tub: floor, seats, dashboard, steering wheel.
  g.add(box(1.6, 0.1, 1.8, M.seat, 0, 0.42, -0.4));
  g.add(box(0.5, 0.5, 0.4, M.seat, -0.38, 0.68, -0.75)); // driver seat back
  g.add(box(0.5, 0.5, 0.4, M.seat, 0.38, 0.68, -0.75)); // passenger seat back
  g.add(box(1.6, 0.22, 0.3, M.dark, 0, 0.78, 0.35)); // dashboard
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 8, 18), M.dark);
  wheel.position.set(-0.38, 0.82, 0.22);
  wheel.rotation.x = -0.5;
  g.add(wheel);
  // Warm cabin light (player car only — traffic cars skip it, see opts).
  let cabinLight = null;
  if (opts.cabinLight) {
    cabinLight = new THREE.PointLight(0xffd9a0, 2.2, 4.5);
    cabinLight.position.set(0, 1.1, -0.4);
    g.add(cabinLight);
  }
  // Side glass: low, raked, both sides.
  g.add(box(0.04, 0.34, 1.5, M.glass, -0.82, 0.88, -0.45, 0, 0, -0.12));
  g.add(box(0.04, 0.34, 1.5, M.glass, 0.82, 0.88, -0.45, 0, 0, 0.12));
  // Roof rails + front header: the frame, with the top OPEN between them.
  const railL = box(0.08, 0.08, 1.7, paintMat, -0.82, 1.02, -0.45);
  const railR = box(0.08, 0.08, 1.7, paintMat, 0.82, 1.02, -0.45);
  const header = box(1.7, 0.08, 0.08, paintMat, 0, 1.03, 0.38);
  g.add(railL, railR, header);
  // Rear glass: raked down to the deck (part of the roof frame).
  const rearGlass = box(1.55, 0.05, 0.6, M.glass, 0, 0.92, -1.35, 0.55);
  g.add(rearGlass);
  const windshield = box(1.55, 0.05, 0.62, M.glass, 0, 0.92, 0.32, -0.55);
  g.add(windshield);

  return { group: g, brakeMat, headMat, cabinLight, roofParts: [railL, railR, header, rearGlass], windshield };
}

function addWheels(g, spec, frontZ, rearZ) {
  const wheels = {};
  const mk = (x, z, front) => {
    const w = buildWheel(spec.wheelRadius);
    w.pivot.position.set(x, spec.wheelRadius, z);
    g.add(w.pivot);
    return w;
  };
  wheels.fl = mk(-1.0, frontZ, true);
  wheels.fr = mk(1.0, frontZ, true);
  wheels.rl = mk(-1.0, rearZ, false);
  wheels.rr = mk(1.0, rearZ, false);
  return wheels;
}

export function buildCoupe(opts = {}) {
  const spec = opts.spec ?? COUPE;
  const { group, brakeMat, cabinLight } = buildCoupeBody(spec, opts);
  const wheels = addWheels(group, spec, 1.75, -1.75);
  // Seated driver, visible through the glasshouse.
  const driver = buildDriver(-0.38);
  driver.position.set(-0.38, 0.42, -0.35);
  group.add(driver);
  return { group, spec, wheels, brakeMats: [brakeMat], cabinLight, driver };
}

export function buildConvertible(opts = {}) {
  const spec = opts.spec ?? CONVERTIBLE;
  const { group, brakeMat, roofParts, windshield } = buildCoupeBody(spec, { ...opts, color: opts.color ?? CONVERTIBLE.color });
  // Open top: remove the roof rails, header and rear glass; swap the tall
  // windshield for a low one.
  for (const part of roofParts) group.remove(part);
  group.remove(windshield);
  group.add(box(1.55, 0.05, 0.4, M.glass, 0, 0.84, 0.36, -0.5));
  const wheels = addWheels(group, spec, 1.75, -1.75);
  // Roll hoop behind the seats.
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 16, Math.PI), M.chrome);
  hoop.position.set(0, 0.85, -0.95);
  hoop.castShadow = true;
  group.add(hoop);
  const driver = buildDriver(-0.38);
  driver.position.set(-0.38, 0.42, -0.35);
  group.add(driver);
  return { group, spec, wheels, brakeMats: [brakeMat], cabinLight: null, driver };
}

export function buildInterceptor(opts = {}) {
  const spec = opts.spec ?? INTERCEPTOR;
  const { group, brakeMat } = buildCoupeBody(spec, { ...opts, color: 0xe8e8e8 });
  // Black hood + trunk band (police livery).
  group.add(box(1.92, 0.03, 2.1, M.dark, 0, 0.82, 1.55, -0.07));
  group.add(box(1.92, 0.03, 1.3, M.dark, 0, 0.83, -1.95));
  const wheels = addWheels(group, spec, 1.75, -1.75);
  // Light bar on the roof rails: red left, blue right, with glow halos.
  const barBase = box(1.15, 0.1, 0.34, M.dark, 0, 1.1, -0.45);
  group.add(barBase);
  const redMat = led(0xff2020, 3.0);
  const blueMat = led(0x2060ff, 3.0);
  const red = box(0.5, 0.12, 0.3, redMat, -0.28, 1.18, -0.45);
  const blue = box(0.5, 0.12, 0.3, blueMat, 0.28, 1.18, -0.45);
  group.add(red, blue);
  // Glow halos need a canvas texture (browser only); in Node the emissive
  // bars alone carry the light-bar look.
  let redGlow = null, blueGlow = null;
  if (typeof document !== 'undefined') {
    redGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xff3030, transparent: true, depthWrite: false }));
    redGlow.scale.set(1.6, 1.6, 1);
    redGlow.position.set(-0.28, 1.25, -0.45);
    blueGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0x3080ff, transparent: true, depthWrite: false }));
    blueGlow.scale.set(1.6, 1.6, 1);
    blueGlow.position.set(0.28, 1.25, -0.45);
    group.add(redGlow, blueGlow);
  }
  const driver = buildDriver(-0.38, new THREE.MeshStandardMaterial({ color: 0x14202e, roughness: 0.8 }));
  driver.position.set(-0.38, 0.42, -0.35);
  group.add(driver);
  return {
    group, spec, wheels, brakeMats: [brakeMat], cabinLight: null, driver,
    lightBar: { redMat, blueMat, redGlow, blueGlow },
  };
}

export function buildTruck(opts = {}) {
  const spec = opts.spec ?? TRUCK;
  const g = new THREE.Group();
  const paintMat = paint(opts.color ?? spec.color);
  const brakeMat = led(0xff1a2a, 1.4);
  const headMat = led(0xfff2c0, 2.2);

  // Chassis + low wide cab (front), ribbed container (rear).
  g.add(box(2.2, 0.35, 7.2, M.dark, 0, 0.55, 0));
  // Cab: z +1.9..+3.8, roof at 2.35.
  g.add(box(2.4, 1.5, 1.9, paintMat, 0, 1.5, 2.85));
  g.add(box(2.42, 0.5, 0.3, M.dark, 0, 0.85, 3.72)); // grille/bumper band
  g.add(box(2.0, 0.9, 0.06, M.glass, 0, 1.85, 3.82, -0.12)); // windshield
  g.add(box(0.4, 0.12, 0.06, headMat, -0.8, 0.95, 3.84));
  g.add(box(0.4, 0.12, 0.06, headMat, 0.8, 0.95, 3.84));
  g.add(box(0.5, 0.14, 0.03, M.plate, 0, 0.6, 3.86));
  // Container: z -3.8..+0.8, ribs on both sides + rear doors.
  g.add(box(2.45, 2.2, 4.6, paintMat, 0, 2.0, -1.5));
  for (let i = 0; i < 9; i += 1) {
    const z = -3.5 + i * 0.5;
    g.add(box(0.06, 2.2, 0.1, M.dark, -1.24, 2.0, z));
    g.add(box(0.06, 2.2, 0.1, M.dark, 1.24, 2.0, z));
  }
  // Rear doors: two panels with vertical ribs and handles.
  g.add(box(1.15, 2.1, 0.06, paintMat, -0.6, 2.0, -3.82));
  g.add(box(1.15, 2.1, 0.06, paintMat, 0.6, 2.0, -3.82));
  for (const x of [-1.05, -0.6, -0.15, 0.15, 0.6, 1.05]) {
    g.add(box(0.05, 2.0, 0.05, M.dark, x, 2.0, -3.86));
  }
  g.add(box(0.08, 0.5, 0.06, M.chrome, -0.15, 2.0, -3.88));
  g.add(box(0.08, 0.5, 0.06, M.chrome, 0.15, 2.0, -3.88));
  // Taillight bar across the rear.
  g.add(box(2.3, 0.1, 0.06, brakeMat, 0, 0.95, -3.84));
  // Six wheels (0.52): front axle + two rear axles.
  const wheels = {};
  const mk = (x, z) => {
    const w = buildWheel(spec.wheelRadius);
    w.pivot.position.set(x, spec.wheelRadius, z);
    g.add(w.pivot);
    return w;
  };
  wheels.fl = mk(-1.05, 2.6);
  wheels.fr = mk(1.05, 2.6);
  wheels.ml = mk(-1.05, -1.4);
  wheels.mr = mk(1.05, -1.4);
  wheels.rl = mk(-1.05, -2.8);
  wheels.rr = mk(1.05, -2.8);
  return { group: g, spec, wheels, brakeMats: [brakeMat], cabinLight: null, driver: null };
}

export function buildTrafficCar(kind, color) {
  if (kind === 'truck') return buildTruck({ color });
  if (kind === 'convertible') return buildConvertible({ color });
  if (kind === 'interceptor') return buildInterceptor({ color });
  return buildCoupe({ color });
}
