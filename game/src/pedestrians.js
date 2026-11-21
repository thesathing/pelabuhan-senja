// PELABUHAN SENJA — pedestrians.
//
// Varied walkers, built joint by joint so none of them is a box on legs:
// different heights, shirt and trouser colours, skin tones, some with hats
// or caps, and a limb-swing walk cycle with a little bob. Twelve stroll the
// sidewalks along the avenues; six more cross the streets back and forth.
// A walker startled by a speeding car hurries away along the pavement, and
// one hit by the player is knocked down, gets up, and runs off.

import * as THREE from '../vendor/three.module.min.js';
import { mulberry32 } from './textures.js';

const SHIRTS = [0xd94f43, 0x3f7d9e, 0xd9a441, 0x5d8a4f, 0xe8e0cc, 0x8a5f9e, 0x2e6f6a, 0xc96a8a, 0x4a6a9e, 0xe07a3a];
const PANTS = [0x2e3440, 0x4a4038, 0x5a6a7a, 0x3a3a44, 0x6a5a4a, 0x24344e];
const SKINS = [0xe8b98a, 0xc98a5e, 0x8a5a3a, 0xf0c8a0, 0xa06a42];
const HAT_COLORS = [0xd9a441, 0x3f7d9e, 0xe8e0cc, 0x8a5f9e, 0x5d8a4f];

const ROADS = [-120, -80, -40, 0, 40, 80, 120];
const SIDEWALK = 6.4;

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

// One walker: torso, head, two arms and two legs as separate meshes so the
// walk cycle can swing them. `height` scales the whole figure.
function buildWalker(rnd) {
  const height = 0.88 + rnd() * 0.26;
  const group = new THREE.Group();
  group.name = 'pedestrian';
  const shirt = SHIRTS[Math.floor(rnd() * SHIRTS.length)];
  const pants = PANTS[Math.floor(rnd() * PANTS.length)];
  const skin = SKINS[Math.floor(rnd() * SKINS.length)];

  // Legs pivot at the hip (y ~0.82); the mesh hangs below its pivot.
  const legL = new THREE.Group();
  legL.position.set(-0.11, 0.82, 0);
  legL.add(box(0.16, 0.82, 0.18, pants, 0, -0.41, 0));
  group.add(legL);
  const legR = new THREE.Group();
  legR.position.set(0.11, 0.82, 0);
  legR.add(box(0.16, 0.82, 0.18, pants, 0, -0.41, 0));
  group.add(legR);

  // Torso and head.
  const torso = box(0.46, 0.62, 0.26, shirt, 0, 1.13, 0);
  group.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 10),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 })
  );
  head.position.set(0, 1.58, 0);
  head.castShadow = true;
  group.add(head);

  // Arms pivot at the shoulder (y ~1.38), hanging below.
  const armL = new THREE.Group();
  armL.position.set(-0.3, 1.38, 0);
  armL.add(box(0.12, 0.58, 0.14, shirt, 0, -0.29, 0));
  const handL = box(0.11, 0.12, 0.12, skin, 0, -0.62, 0);
  armL.add(handL);
  group.add(armL);
  const armR = new THREE.Group();
  armR.position.set(0.3, 1.38, 0);
  armR.add(box(0.12, 0.58, 0.14, shirt, 0, -0.29, 0));
  armR.add(box(0.11, 0.12, 0.12, skin, 0, -0.62, 0));
  group.add(armR);

  // A hat for about four in ten walkers: a straw hat, a cap, or a beanie.
  const hatRoll = rnd();
  if (hatRoll < 0.18) {
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.03, 14),
      new THREE.MeshStandardMaterial({ color: HAT_COLORS[Math.floor(rnd() * HAT_COLORS.length)], roughness: 1 })
    );
    brim.position.set(0, 1.7, 0);
    group.add(brim);
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.17, 0.12, 12),
      brim.material
    );
    crown.position.set(0, 1.77, 0);
    group.add(crown);
  } else if (hatRoll < 0.32) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: HAT_COLORS[Math.floor(rnd() * HAT_COLORS.length)], roughness: 0.95 })
    );
    cap.position.set(0, 1.68, 0);
    group.add(cap);
    const peak = box(0.24, 0.03, 0.16, 0x2e2e36, 0, 1.68, -0.2);
    group.add(peak);
  } else if (hatRoll < 0.42) {
    const beanie = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 1 })
    );
    beanie.position.set(0, 1.66, 0);
    group.add(beanie);
  }

  group.scale.setScalar(height);
  return { group, legL, legR, armL, armR, height };
}

export class PedestrianSystem {
  constructor(scene) {
    const rnd = mulberry32(20261121);
    this.scene = scene;
    this.walkers = [];

    // Sidewalk strollers: along a north-south or east-west avenue, on the
    // pavement just off the asphalt, walking between two intersections.
    for (let i = 0; i < 12; i++) {
      const alongRoad = i % 2 === 0;
      const road = ROADS[Math.floor(rnd() * ROADS.length)];
      const side = rnd() < 0.5 ? -1 : 1;
      const fixed = road + side * SIDEWALK;
      const from = -120 + Math.floor(rnd() * 3) * 40;
      const to = from + 40 + Math.floor(rnd() * 2) * 40;
      const walker = this.spawnWalker(rnd, {
        axis: alongRoad ? 'z' : 'x',
        fixed,
        from: Math.max(-140, from),
        to: Math.min(140, to),
      });
      this.walkers.push(walker);
    }

    // Street crossers: back and forth across one avenue, clear of the
    // market stalls (which sit at x = -54, -28, -2, 24, 50 on z = +/-8).
    const crossX = [-100, -70, 10, 70, 100, 120];
    for (let i = 0; i < 6; i++) {
      const road = ROADS[1 + Math.floor(rnd() * (ROADS.length - 2))];
      const walker = this.spawnWalker(rnd, {
        axis: 'x',
        fixed: road + (rnd() < 0.5 ? -1 : 1) * 2,
        from: crossX[i] - 9,
        to: crossX[i] + 9,
        crossing: true,
      });
      this.walkers.push(walker);
    }
  }

  spawnWalker(rnd, path) {
    const parts = buildWalker(rnd);
    const walker = {
      ...parts,
      path,
      phase: rnd() * Math.PI * 2,
      walkSpeed: 0.9 + rnd() * 0.7,
      speed: 0,
      dir: rnd() < 0.5 ? 1 : -1,
      state: 'walk',
      stateTimer: 0,
      pos: new THREE.Vector3(),
    };
    // Start somewhere along the path.
    const along = path.from + rnd() * (path.to - path.from);
    if (path.axis === 'z') walker.pos.set(path.fixed, 0, along);
    else walker.pos.set(along, 0, path.fixed);
    walker.group.position.copy(walker.pos);
    this.scene.add(walker.group);
    return walker;
  }

  // Heading for a walker moving along `axis` in direction `dir`:
  // forward is (-sin h, 0, -cos h), so +z is PI, -z is 0, +x is -PI/2.
  headingFor(axis, dir) {
    if (axis === 'z') return dir > 0 ? Math.PI : 0;
    return dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  }

  // Knock down every walker within `radius` of (x, z). Returns how many.
  knockDownAt(x, z, radius) {
    let hit = 0;
    for (const w of this.walkers) {
      if (w.state === 'down') continue;
      const dx = w.pos.x - x;
      const dz = w.pos.z - z;
      if (dx * dx + dz * dz > radius * radius) continue;
      w.state = 'down';
      w.stateTimer = 4;
      w.group.rotation.set(0, 0, Math.PI / 2);
      w.group.position.y = 0.25;
      hit++;
    }
    return hit;
  }

  update(dt, playerPos, playerSpeed) {
    for (const w of this.walkers) {
      if (w.state === 'down') {
        w.stateTimer -= dt;
        if (w.stateTimer <= 0) {
          // Get up and run away along the pavement.
          w.state = 'flee';
          w.stateTimer = 2.5;
          w.group.rotation.set(0, this.headingFor(w.path.axis, w.dir), 0);
          w.group.position.y = 0;
        }
        continue;
      }

      // A fast car closing in startles the walker into a hurry.
      if (w.state === 'walk' && Math.abs(playerSpeed) > 6) {
        const dx = w.pos.x - playerPos.x;
        const dz = w.pos.z - playerPos.z;
        if (dx * dx + dz * dz < 36) {
          w.state = 'flee';
          w.stateTimer = 1.6;
          // Run away from the car along the path, whichever way that is.
          const along = w.path.axis === 'z' ? dz : dx;
          w.dir = along >= 0 ? 1 : -1;
        }
      }
      if (w.state === 'flee') {
        w.stateTimer -= dt;
        if (w.stateTimer <= 0) w.state = 'walk';
      }

      const speed = w.state === 'flee' ? w.walkSpeed * 3 : w.walkSpeed;
      const step = speed * dt;
      let along = w.path.axis === 'z' ? w.pos.z : w.pos.x;
      along += w.dir * step;
      if (along > w.path.to) {
        along = w.path.to;
        w.dir = -1;
      } else if (along < w.path.from) {
        along = w.path.from;
        w.dir = 1;
      }
      if (w.path.axis === 'z') w.pos.set(w.path.fixed, 0, along);
      else w.pos.set(along, 0, w.path.fixed);

      // Walk cycle: legs and arms swing opposite, with a small bob.
      w.phase += dt * speed * 5.2;
      const swing = Math.sin(w.phase);
      w.legL.rotation.x = swing * 0.55;
      w.legR.rotation.x = -swing * 0.55;
      w.armL.rotation.x = -swing * 0.4;
      w.armR.rotation.x = swing * 0.4;
      w.group.position.set(w.pos.x, Math.abs(Math.cos(w.phase)) * 0.05, w.pos.z);
      w.group.rotation.y = this.headingFor(w.path.axis, w.dir);
    }
  }

  get aliveCount() {
    return this.walkers.length;
  }
}
