import * as THREE from './vendor/three.module.min.js';

// Real GT sports-car bodies: smooth lofts with superellipse cross-sections.
// Local frame: +X is the front of the vehicle, +Z is its left side, Y is up.
// Bodies are sculpted, never a single box: long sloped hood, cab-rearward
// glasshouse, low wide stance, big wheels, splitter, skirts, spoiler.

function superellipse(angle, hw, hh, n) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [
    hh * Math.sign(s) * Math.pow(Math.abs(s), 2 / n),
    hw * Math.sign(c) * Math.pow(Math.abs(c), 2 / n),
  ];
}

// stations: [{x, hw, cy, hh, n}] — one ring per station, smooth normals.
export function loftGeometry(stations, radial = 24) {
  const positions = [], uvs = [], indices = [];
  const per = radial + 1;
  for (let i = 0; i < stations.length; i++) {
    const st = stations[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const [dy, dz] = superellipse(a, st.hw, st.hh, st.n || 2.6);
      positions.push(st.x, st.cy + dy, dz);
      uvs.push(i / (stations.length - 1), j / radial);
    }
  }
  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * per + j, b = a + 1, c = a + per, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const cap = (ring, flip) => {
    const ci = positions.length / 3, st = stations[ring];
    positions.push(st.x, st.cy, 0); uvs.push(0.5, 0.5);
    for (let j = 0; j < radial; j++) {
      const a = ring * per + j, b = ring * per + j + 1;
      if (flip) indices.push(ci, b, a); else indices.push(ci, a, b);
    }
  };
  cap(0, false);
  cap(stations.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function tireTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#17181a'; x.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 32; i++) { x.fillStyle = '#2c2e30'; x.fillRect(i * 8 + 1, 0, 4, 64); }
  x.fillStyle = '#232527'; x.fillRect(0, 0, 256, 10); x.fillRect(0, 54, 256, 10);
  x.fillStyle = '#3a3d3f'; x.fillRect(0, 26, 256, 3); x.fillRect(0, 35, 256, 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
let tireMat = null;
function tireMaterial() {
  if (!tireMat) tireMat = new THREE.MeshStandardMaterial({map: tireTexture(), roughness: .92, metalness: 0});
  return tireMat;
}

const std = (color, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
const paint = color => new THREE.MeshStandardMaterial({color, roughness: .12, metalness: .6, envMapIntensity: 1.35});
const glassMat = new THREE.MeshStandardMaterial({color: '#b9c6d8', roughness: .05, metalness: .12, transparent: true, opacity: .42, envMapIntensity: 1.6});
const chromeMat = new THREE.MeshStandardMaterial({color: '#d8dde0', roughness: .16, metalness: .95, envMapIntensity: 1.2});
// Dark gunmetal grille: chrome slats reflect the pink dusk and read as a
// stack of white bars, so the grille uses this matte gunmetal instead.
const grilleMat = new THREE.MeshStandardMaterial({color: '#4a5058', roughness: .6, metalness: .2, envMapIntensity: .5});
const darkTrim = std('#232a2a', .7);
const carbonMat = std('#16181a', .5, .3);
const bumperMat = std('#2b2f2e', .45, .35);
const headlampMat = new THREE.MeshStandardMaterial({color: '#e8eef7', emissive: '#cfe0f5', emissiveIntensity: 1.1, roughness: .2});
const tailMat = new THREE.MeshStandardMaterial({color: '#ff5a4a', emissive: '#c81f18', emissiveIntensity: 1.6, roughness: .3});
const plateMat = std('#e8e4d4', .5);
const hubMat = new THREE.MeshStandardMaterial({color: '#cfd4d6', roughness: .25, metalness: .85, envMapIntensity: 1.1});

function add(group, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  group.add(m);
  return m;
}
function box(group, mat, x, y, z, sx, sy, sz, shadow = true) {
  return add(group, new THREE.BoxGeometry(sx, sy, sz), mat, x, y, z, shadow);
}

// Wheel: torus tire with tread texture, big hub with spokes, center cap.
// side: +1 for the left (+Z) side, -1 for the right — spokes sit on the outer face.
function createWheel(radius, side) {
  const g = new THREE.Group();
  // Torus ring already lies in the XY plane, axle along Z — no rotation needed.
  add(g, new THREE.TorusGeometry(radius - .13, .13, 12, 28), tireMaterial());
  const hubR = radius * .5;
  const hub = add(g, new THREE.CylinderGeometry(hubR, hubR, .26, 20), hubMat);
  hub.rotation.x = Math.PI / 2;
  for (let k = 0; k < 5; k++) {
    const sp = box(g, hubMat, 0, 0, side * .15, hubR * 1.7, .06, .03, false);
    sp.rotation.z = k * Math.PI / 5;
  }
  const cap = add(g, new THREE.CylinderGeometry(.07, .07, .3, 12), darkTrim);
  cap.rotation.x = Math.PI / 2;
  return g;
}

// Curved fender arch over a wheel.
function fenderArch(group, x, y, z, radius, mat) {
  const m = add(group, new THREE.TorusGeometry(radius, .09, 8, 20, Math.PI), mat, x, y, z);
  return m;
}

function lens(group, mat, x, y, z, sx, sy, sz) {
  const m = add(group, new THREE.SphereGeometry(.14, 16, 12), mat, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

// GT coupe body: 5.2 long, 2.1 wide, body top 0.68 — long hood, short rear deck.
// Wheels are 0.38 radius (0.76 diameter vs 0.975 total height): big for a
// sports car, but the wheel tops stay below the beltline — 0.52 wheels made
// the cars read as go-karts, the wheel taller than the body.
function gtBodyStations() {
  return [
    {x: 2.60, hw: .60, cy: .38, hh: .18, n: 2.0},
    {x: 2.45, hw: .86, cy: .40, hh: .24, n: 2.2},
    {x: 2.10, hw: .99, cy: .40, hh: .27, n: 2.4},
    {x: 1.60, hw: 1.02, cy: .40, hh: .28, n: 2.6},
    {x: 0.90, hw: 1.03, cy: .40, hh: .28, n: 2.6},
    {x: 0.30, hw: 1.03, cy: .40, hh: .28, n: 2.6},
    {x: -0.40, hw: 1.02, cy: .40, hh: .28, n: 2.6},
    {x: -1.10, hw: 1.00, cy: .40, hh: .28, n: 2.6},
    {x: -1.80, hw: .97, cy: .40, hh: .27, n: 2.6},
    {x: -2.30, hw: .90, cy: .40, hh: .25, n: 2.4},
    {x: -2.60, hw: .68, cy: .40, hh: .21, n: 2.0},
  ];
}

// Small, low, steeply raked glasshouse, set back from the nose: the hood is
// longer than the cabin, so the car reads as a GT, never a bubble.
function coupeGlasshouseStations() {
  return [
    {x: -1.30, hw: .55, cy: .72, hh: .10, n: 2.2},
    {x: -1.00, hw: .68, cy: .74, hh: .16, n: 2.6},
    {x: -0.40, hw: .72, cy: .75, hh: .19, n: 3.0},
    {x: 0.10, hw: .72, cy: .75, hh: .19, n: 3.0},
    {x: 0.50, hw: .60, cy: .72, hh: .13, n: 2.4},
  ];
}

// Four-door GT sedan: same low body, slightly longer glasshouse.
function sedanGlasshouseStations() {
  return [
    {x: -1.55, hw: .55, cy: .72, hh: .10, n: 2.2},
    {x: -1.20, hw: .68, cy: .74, hh: .16, n: 2.6},
    {x: -0.50, hw: .72, cy: .75, hh: .19, n: 3.0},
    {x: 0.20, hw: .72, cy: .75, hh: .19, n: 3.0},
    {x: 0.45, hw: .60, cy: .72, hh: .13, n: 2.4},
  ];
}

function roofStations(glass) {
  const rear = glass[0].x + .15, front = glass[glass.length - 1].x - .2;
  return [
    {x: rear, hw: .70, cy: .93, hh: .045, n: 2.4},
    {x: (rear + front) / 2, hw: .72, cy: .93, hh: .045, n: 2.4},
    {x: front, hw: .68, cy: .93, hh: .045, n: 2.4},
  ];
}

// Measured GT proportions, computed from the same station data the bodies
// are built from — the contract test asserts sports-car ranges on these.
export function sportsCarProportions() {
  const body = gtBodyStations();
  const glass = coupeGlasshouseStations();
  const roof = roofStations(glass);
  const bodyTop = Math.max(...body.map(s => s.cy + s.hh));
  const roofY = Math.max(...glass.map(s => s.cy + s.hh), ...roof.map(s => s.cy + s.hh));
  const noseX = Math.max(...body.map(s => s.x));
  const windshieldBaseX = glass[glass.length - 1].x;
  const cabinRearX = glass[0].x;
  return {
    roofY: +roofY.toFixed(3),
    bodyHeight: +bodyTop.toFixed(3),
    glasshouseHeight: +(roofY - bodyTop).toFixed(3),
    hoodLength: +(noseX - windshieldBaseX).toFixed(3),
    cabinLength: +(windshieldBaseX - cabinRearX).toFixed(3),
    wheelRadius: .38,
    width: 2.1,
    length: 5.2,
  };
}

function buildCarBody(g, type, color, police) {
  const bodyMat = paint(color);
  // Per-car brake-light material: the game raises its emissive glow while
  // braking, so it must not be shared with other cars. Kept dim and red so
  // the full-width bar never reads as a flat white tape strip.
  const brakeMat = new THREE.MeshStandardMaterial({color: '#d63a28', emissive: '#7a0f06', emissiveIntensity: 0.9, roughness: .3});
  const brakeLights = [];
  const L = type === 'truck' ? 7.8 : type === 'pickup' ? 6.1 : type === 'sedan' ? 5.0 : 5.2;
  const W = type === 'truck' ? 2.2 : 2.1;
  const wheelR = type === 'truck' ? .52 : .38;
  const wheelY = type === 'truck' ? .32 : .18;
  const wheelX = type === 'truck' ? 2.5 : L * .33;

  if (type === 'truck') {
    buildTruck(g, bodyMat, brakeMat, brakeLights);
  } else {
    const stations = gtBodyStations();
    const sx = L / 5.2;
    const body = stations.map(s => ({...s, x: s.x * sx}));
    if (type === 'pickup') {
      for (const s of body) if (s.x < -0.5 * sx) { s.hh = .14; s.cy = .40; }
    }
    add(g, loftGeometry(body, 24), bodyMat, 0, 0, 0);
    if (type === 'convertible') {
      // Open top: no glass dome at all — dark interior tub, two seats, a low
      // raked windscreen strip, and roll hoops behind the seats.
      box(g, darkTrim, -0.35, .62, 0, 1.9, .1, 1.7, false);
      for (const s of [-1, 1]) {
        box(g, std('#2a2f33', .9), -0.75, .72, s * .45, .18, .42, .5, false);
        box(g, std('#2a2f33', .9), -0.85, .58, s * .45, .45, .1, .5, false);
        const hoop = add(g, new THREE.TorusGeometry(.3, .045, 8, 16, Math.PI), chromeMat, -1.05, .68, s * .45);
        hoop.rotation.y = Math.PI / 2;
      }
      const screen = add(g, loftGeometry([
        {x: 0.45, hw: .68, cy: .78, hh: .06, n: 2.4},
        {x: 0.62, hw: .68, cy: .84, hh: .06, n: 2.4},
      ], 16), glassMat, 0, 0, 0, false);
      screen.scale.set(1, 1, 1);
    } else {
      const glass = type === 'sedan' ? sedanGlasshouseStations() : coupeGlasshouseStations();
      add(g, loftGeometry(glass, 20), glassMat, 0, 0, 0, false);
      add(g, loftGeometry(roofStations(glass), 16), bodyMat, 0, 0, 0);
    }
    if (type === 'pickup') {
      // Open bed: dark floor, side walls, tailgate.
      box(g, std('#433b33', .9), -1.55, .58, 0, 1.7, .08, 1.8);
      for (const s of [-1, 1]) box(g, bodyMat, -1.55, .72, s * .95, 1.7, .3, .08);
      box(g, bodyMat, -2.42, .72, 0, .08, .3, 1.9);
    }
  }

  const frontX = type === 'truck' ? 3.9 : L / 2;
  const rearX = type === 'truck' ? -3.9 : -L / 2;
  // Big wheels on a wide track, with fender arches.
  for (const xx of [-wheelX, wheelX]) for (const s of [-1, 1]) {
    const w = createWheel(wheelR, s);
    w.position.set(xx, wheelY, s * (W / 2 - .02));
    g.add(w);
    fenderArch(g, xx, wheelY, s * (W / 2 - .02), wheelR + .08, bodyMat);
  }
  if (type !== 'truck') {
    // Front splitter + fins, side skirts, side air intakes, hood vents.
    box(g, carbonMat, frontX - .06, .1, 0, .34, .06, 1.9, false);
    for (const s of [-1, 1]) box(g, carbonMat, frontX - .06, .16, s * .8, .2, .12, .05, false);
    for (const s of [-1, 1]) box(g, carbonMat, 0, .14, s * (W / 2 + .01), 2.7, .09, .05, false);
    for (const s of [-1, 1]) box(g, darkTrim, -0.95, .44, s * (W / 2 + .005), .5, .18, .04, false);
    for (const s of [-1, 1]) box(g, darkTrim, 1.55, .68, s * .34, .55, .02, .16, false);
    // Rear spoiler on struts + diffuser with fins.
    for (const s of [-1, 1]) box(g, carbonMat, -2.42, .74, s * .6, .08, .14, .06, false);
    box(g, bodyMat, -2.48, .84, 0, .34, .045, 1.7, false);
    box(g, carbonMat, rearX + .08, .14, 0, .3, .12, 1.6, false);
    for (const s of [-1, 1]) box(g, carbonMat, rearX + .08, .14, s * .55, .3, .12, .04, false);
    // Thin LED headlight strips + low wide grille.
    for (const s of [-1, 1]) box(g, headlampMat, frontX + .01, .54, s * .6, .05, .07, .62, false);
    box(g, darkTrim, frontX + .01, .28, 0, .05, .16, 1.35, false);
    for (let i = 0; i < 3; i++) box(g, grilleMat, frontX + .04, .22 + i * .06, 0, .03, .02, 1.25, false);
    // Full-width taillight bar (brake lights) + dual exhaust tips.
    const bar = box(g, brakeMat, rearX - .01, .56, 0, .05, .09, 1.72, false);
    brakeLights.push(bar);
    for (const s of [-1, 1]) {
      const ex = add(g, new THREE.CylinderGeometry(.05, .05, .22, 10), chromeMat, rearX - .02, .18, s * .5);
      ex.rotation.z = Math.PI / 2;
    }
    // Mirrors, door handles, plate, antenna fin.
    for (const s of [-1, 1]) {
      box(g, bodyMat, 0.35, .78, s * 1.08, .1, .13, .07);
      box(g, darkTrim, 0.35, .78, s * 1.01, .06, .05, .12, false);
      box(g, chromeMat, -0.25, .62, s * (W / 2 + .015), .22, .035, .03, false);
      box(g, chromeMat, -0.95, .62, s * (W / 2 + .015), .22, .035, .03, false);
    }
    box(g, plateMat, frontX + .03, .3, 0, .04, .22, .55, false);
    box(g, plateMat, rearX - .03, .3, 0, .04, .22, .55, false);
    box(g, carbonMat, -1.05, 1.0, 0, .3, .09, .05, false);
  } else {
    // Truck: round lamps, grille, mirrors, plates, exhaust, antenna.
    const fx = 3.82;
    for (const s of [-1, 1]) {
      lens(g, headlampMat, fx, .62, s * .62, .9, .6, 1.1);
      const tl = lens(g, brakeMat, rearX + .06, .5, s * .62, .8, .9, 1.4);
      brakeLights.push(tl);
      box(g, bodyMat, 3.1, 1.08, s * 1.1, .1, .14, .07);
      box(g, darkTrim, 3.1, 1.08, s * 1.02, .06, .05, .12, false);
      box(g, chromeMat, 2.2, .82, s * (W / 2 + .015), .2, .035, .03, false);
      box(g, chromeMat, -0.55, .82, s * (W / 2 + .015), .2, .035, .03, false);
    }
    box(g, plateMat, frontX + .03, .3, 0, .04, .22, .55, false);
    box(g, plateMat, rearX - .03, .3, 0, .04, .22, .55, false);
    const exhaust = add(g, new THREE.CylinderGeometry(.055, .055, .3, 10), darkTrim, rearX + .08, .16, .55);
    exhaust.rotation.z = Math.PI / 2;
    const antenna = add(g, new THREE.CylinderGeometry(.012, .012, .45, 6), darkTrim, 1.6, 1.78, .5, false);
    antenna.rotation.z = .1;
  }
  // Front and rear bumper bands are gone: the splitter and diffuser do that job.

  if (police) {
    // Interceptor: dark side band + roof light bar with red/blue lenses.
    for (const s of [-1, 1]) box(g, std('#2c3e46', .5, .2), 0, .55, s * (W / 2 + .01), 2.6, .18, .03, false);
    box(g, std('#1c2224', .5), 0, 1.0, 0, .9, .08, .5);
    for (const s of [-1, 1]) {
      const dome = box(g, new THREE.MeshBasicMaterial({color: s < 0 ? '#ff4848' : '#477bff'}), 0, 1.08, s * .2, .5, .09, .32, false);
      dome.userData.siren = true;
    }
  }
  g.userData.brakeLights = brakeLights;
  return {length: L, width: W, wheelR, roofY: type === 'truck' ? 1.63 : .98};
}

function buildTruck(g, bodyMat, brakeMat, brakeLights) {
  // Lower, wider cab: beltline loft (paint) — the glass cabin sits on top of
  // it, so the driver stays visible through real glass instead of opaque paint.
  const lowerCab = [
    {x: 1.15, hw: 1.04, cy: .66, hh: .50, n: 2.4},
    {x: 1.60, hw: 1.08, cy: .66, hh: .50, n: 2.6},
    {x: 2.60, hw: 1.08, cy: .66, hh: .50, n: 2.6},
    {x: 3.20, hw: 1.06, cy: .65, hh: .48, n: 2.4},
    {x: 3.65, hw: .98, cy: .63, hh: .44, n: 2.2},
    {x: 3.90, hw: .85, cy: .60, hh: .38, n: 2.0},
  ];
  add(g, loftGeometry(lowerCab, 20), bodyMat, 0, 0, 0);
  // Glass cabin: sloped windshield + side glass, with a painted roof on top.
  const cabGlass = [
    {x: 1.40, hw: .84, cy: 1.18, hh: .30, n: 2.2},
    {x: 1.80, hw: .90, cy: 1.20, hh: .38, n: 2.6},
    {x: 2.60, hw: .90, cy: 1.20, hh: .38, n: 2.6},
    {x: 3.10, hw: .88, cy: 1.18, hh: .36, n: 2.4},
    {x: 3.60, hw: .76, cy: 1.02, hh: .26, n: 2.2},
  ];
  add(g, loftGeometry(cabGlass, 20), glassMat, 0, 0, 0, false);
  const cabRoof = [
    {x: 1.70, hw: .84, cy: 1.58, hh: .05, n: 2.4},
    {x: 2.60, hw: .90, cy: 1.60, hh: .06, n: 2.4},
    {x: 3.10, hw: .84, cy: 1.58, hh: .05, n: 2.4},
  ];
  add(g, loftGeometry(cabRoof, 16), bodyMat, 0, 0, 0);
  // Grille + slats on the cab nose.
  box(g, darkTrim, 3.9, .72, 0, .06, .34, 1.2);
  for (let i = 0; i < 3; i++) box(g, grilleMat, 3.94, .62 + i * .1, 0, .03, .04, 1.1, false);
  // Ribbed container: rounded-corner extrusion, panel ribs, rear doors.
  const shape = roundedRectShape(2.1, 2.0, .18);
  const geo = new THREE.ExtrudeGeometry(shape, {depth: 5.1, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 2, steps: 1});
  geo.rotateY(Math.PI / 2);
  geo.translate(-3.85, 0, 0);
  const containerMat = paint('#8f7d5c');
  add(g, geo, containerMat, 0, 1.55, 0);
  for (let i = 0; i < 7; i++) box(g, std('#7a6a4e', .85), -3.6 + i * .75, 1.55, 0, .06, 1.9, 2.26, false);
  box(g, std('#6b5c42', .85), -3.88, 1.55, 0, .08, 1.9, 2.0, false);
  for (const s of [-1, 1]) box(g, std('#9a8867', .85), -3.93, 1.55, s * .5, .05, 1.7, .9, false);
  for (const s of [-1, 1]) box(g, std('#4a4238', .8), -3.9, 1.55, s * 1.0, .05, 1.8, .06, false);
}

// Merge several geometries (indexed or not) into one, carrying a per-piece color.
export function mergeGeometries(pieces) {
  let vCount = 0, iCount = 0;
  for (const p of pieces) { vCount += p.geo.attributes.position.count; iCount += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), col = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (const p of pieces) {
    const g = p.geo, count = g.attributes.position.count;
    const color = new THREE.Color(p.color);
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(g.attributes.position, i).applyMatrix4(p.matrix);
      pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      if (g.attributes.normal) {
        n.fromBufferAttribute(g.attributes.normal, i).transformDirection(p.matrix);
        nor[(vo + i) * 3] = n.x; nor[(vo + i) * 3 + 1] = n.y; nor[(vo + i) * 3 + 2] = n.z;
      }
      col[(vo + i) * 3] = color.r; col[(vo + i) * 3 + 1] = color.g; col[(vo + i) * 3 + 2] = color.b;
      if (g.attributes.uv) { uv[(vo + i) * 2] = g.attributes.uv.getX(i); uv[(vo + i) * 2 + 1] = g.attributes.uv.getY(i); }
    }
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo; io += g.index.count; }
    else { for (let i = 0; i < count; i++) idx[io + i] = vo + i; io += count; }
    vo += count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

export function xform(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  m.scale(new THREE.Vector3(sx, sy, sz));
  m.setPosition(x, y, z);
  return m;
}

export {paint, glassMat, chromeMat, grilleMat, darkTrim, bumperMat, headlampMat, tailMat, plateMat, buildCarBody};
