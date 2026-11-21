// PELABUHAN SENJA — vehicles.
//
// Cars are built, not boxed: each body is an extruded side profile — a
// sloped hood, a raked windshield, a roofline and a cut-off tail — with a
// separate dark glass cabin, four wheels with hubcaps, headlights and
// taillights, a grille, bumpers and mirrors. Four body styles (sport coupe,
// sedan, hatchback, van) in several colours make up the player car and the
// traffic; traffic cars follow the block loops world.js hands out.

import * as THREE from '../vendor/three.module.min.js';

// Side profiles, in metres: [x along the car, y above the ground]. The car
// faces -Z in its local space; heading 0 drives north.
//
// The body profile stops at the beltline (~1.0 m): the glass cabin below
// rises above it, so the dark glasshouse reads from every angle instead of
// hiding inside the body.
const PROFILES = {
  coupe: [
    [-2.15, 0.32], [-2.2, 0.62], [-1.95, 0.78], [-1.15, 0.92], [-0.55, 1.0],
    [0.35, 1.02], [0.95, 0.98], [1.75, 0.95], [2.15, 0.8], [2.2, 0.55], [2.1, 0.32],
  ],
  sedan: [
    [-2.2, 0.32], [-2.25, 0.66], [-1.9, 0.86], [-1.05, 0.98], [-0.6, 1.04],
    [0.55, 1.05], [1.05, 1.0], [1.8, 0.97], [2.2, 0.82], [2.25, 0.55], [2.12, 0.32],
  ],
  hatch: [
    [-1.85, 0.32], [-1.9, 0.62], [-1.6, 0.82], [-0.9, 0.98], [-0.5, 1.04],
    [0.4, 1.05], [1.05, 1.02], [1.8, 0.98], [1.9, 0.6], [1.8, 0.32],
  ],
  van: [
    [-2.3, 0.35], [-2.35, 0.9], [-2.0, 1.35], [-1.5, 1.55], [0.9, 1.58],
    [2.2, 1.55], [2.35, 1.2], [2.3, 0.35],
  ],
};

// Glass cabin profiles: narrower than the body, and taller than its
// beltline, so the glasshouse stands proud of the paint.
const CABINS = {
  coupe: [
    [-1.05, 0.9], [-0.6, 1.26], [0.3, 1.28], [0.85, 1.0], [0.85, 0.9],
  ],
  sedan: [
    [-1.0, 0.98], [-0.58, 1.32], [0.5, 1.34], [0.95, 1.0], [0.95, 0.98],
  ],
  hatch: [
    [-0.85, 0.96], [-0.48, 1.3], [0.35, 1.32], [0.95, 1.28], [0.95, 0.96],
  ],
  van: [
    [-1.95, 1.3], [-1.5, 1.92], [0.85, 1.95], [0.85, 1.3],
  ],
};

const WIDTHS = { coupe: 1.9, sedan: 1.9, hatch: 1.8, van: 2.0 };

function extrudeProfile(points, width, material) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.07,
    bevelSegments: 2,
    steps: 1,
  });
  // Extrude runs along +Z; centre the body on the car and lay it across,
  // rotating -90° about Y so the profile's front (-x) becomes -Z.
  geo.translate(0, 0, -width / 2);
  geo.rotateY(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function wheelMesh() {
  const group = new THREE.Group();
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18),
    new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.95 })
  );
  tire.rotation.x = Math.PI / 2;
  tire.castShadow = true;
  group.add(tire);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.28, 12),
    new THREE.MeshStandardMaterial({ color: 0xc9c9d4, roughness: 0.3, metalness: 0.8 })
  );
  hub.rotation.x = Math.PI / 2;
  group.add(hub);
  return group;
}

// Builds one car. `kind` picks the profile; `color` is the paint.
// The returned group faces -Z when its heading is 0.
export function createCar(kind, color) {
  const profile = PROFILES[kind] ?? PROFILES.sedan;
  const cabinProfile = CABINS[kind] ?? CABINS.sedan;
  const width = WIDTHS[kind] ?? 1.9;
  const car = new THREE.Group();
  car.name = `car-${kind}`;

  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.55 });
  car.add(extrudeProfile(profile, width, paint));

  const glass = new THREE.MeshStandardMaterial({ color: 0x10182a, roughness: 0.08, metalness: 0.9 });
  car.add(extrudeProfile(cabinProfile, width - 0.24, glass));

  // Wheels: front axle near the hood, rear axle near the tail.
  const wheelZ = kind === 'van' ? [-1.55, 1.55] : [-1.45, 1.45];
  for (const z of wheelZ) {
    for (const side of [-1, 1]) {
      const wheel = wheelMesh();
      wheel.position.set(side * (width / 2 + 0.02), 0.36, z);
      car.add(wheel);
    }
  }

  // Headlights (front is -Z) and taillights, both emissive so they read at dusk.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf8a, emissiveIntensity: 1.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2211, emissiveIntensity: 1.4 });
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headMat);
    head.position.set(side * (width / 2 - 0.45), 0.72, -2.18);
    car.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), tailMat);
    tail.position.set(side * (width / 2 - 0.45), 0.78, 2.18);
    car.add(tail);
    // Side mirrors.
    const mirror = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.12, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.4, metalness: 0.4 })
    );
    mirror.position.set(side * (width / 2 + 0.08), 1.08, -0.75);
    car.add(mirror);
  }

  // Grille and bumpers.
  const darkTrim = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.5, metalness: 0.5 });
  const grille = new THREE.Mesh(new THREE.BoxGeometry(width - 0.7, 0.22, 0.1), darkTrim);
  grille.position.set(0, 0.55, -2.2);
  car.add(grille);
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.22, 0.14), darkTrim);
  bumperF.position.set(0, 0.38, -2.2);
  car.add(bumperF);
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(width + 0.06, 0.22, 0.14), darkTrim);
  bumperR.position.set(0, 0.38, 2.2);
  car.add(bumperR);

  return car;
}

export function makePlayerCar() {
  return createCar('coupe', 0xff6a1f);
}

const TRAFFIC_STYLES = [
  ['sedan', 0x3f7d9e],
  ['hatch', 0xd9c23c],
  ['sedan', 0x8a8f96],
  ['van', 0xe8e0cc],
  ['hatch', 0x5d8a4f],
  ['sedan', 0x7a4a6e],
];

// One traffic car plus its loop state. `makeTrafficCar` places it on a loop;
// `updateTrafficCar` steers it along the loop's waypoints.
export function makeTrafficCar(index, loop) {
  const [kind, color] = TRAFFIC_STYLES[index % TRAFFIC_STYLES.length];
  const mesh = createCar(kind, color);
  const start = loop[index % loop.length].clone();
  mesh.position.copy(start);
  mesh.position.y = 0;
  return {
    mesh,
    loop,
    target: (index + 1) % loop.length,
    speed: 6 + (index % 3) * 1.6,
    heading: 0,
  };
}

export function updateTrafficCar(car, dt) {
  const target = car.loop[car.target];
  const dx = target.x - car.mesh.position.x;
  const dz = target.z - car.mesh.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 3) {
    car.target = (car.target + 1) % car.loop.length;
    return;
  }
  // Heading convention (shared with main.js): heading 0 faces -Z, and the
  // car's forward vector is (-sin(heading), 0, -cos(heading)), which is
  // exactly where rotation.y = heading points the car's nose (-Z local).
  const want = Math.atan2(-dx, -dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
  car.mesh.position.x += -Math.sin(car.heading) * car.speed * dt;
  car.mesh.position.z += -Math.cos(car.heading) * car.speed * dt;
  car.mesh.rotation.y = car.heading;
}
