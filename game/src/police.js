// PELABUHAN SENJA — police and the wanted level.
//
// The law in Pelabuhan Senja runs on heat: reckless driving, hitting a
// traffic car or a pedestrian, and speeding past a cruiser all raise it,
// and five stars is the most the city can throw at you. Heat decays when
// the player breaks away and stays out of sight. Cruisers chase along the
// road grid (Manhattan pursuit, so they stay on the asphalt), flash red
// and blue, and try to cut the player off; at three stars a helicopter
// joins with a searchlight cone tracking the car. Get caught slow and
// surrounded and you are busted: the heat resets and the chase ends.

import * as THREE from '../vendor/three.module.min.js';
import { createCar } from './vehicles.js';

// Heat needed to reach each wanted level (index = stars).
const HEAT_FOR_STARS = [0, 20, 40, 55, 70, 85];
const MAX_CRUISERS = 5;
const BUST_TIME = 3;

function snapRoad(v) {
  return Math.max(-120, Math.min(120, Math.round(v / 40) * 40));
}

function buildCruiser() {
  const mesh = createCar('sedan', 0xeef0f2);
  mesh.name = 'police-cruiser';

  // A black band along the doors, so it reads as a patrol car, not a taxi.
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(1.94, 0.22, 3.4),
    new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.5, metalness: 0.4 })
  );
  band.position.set(0, 0.62, 0.1);
  mesh.add(band);

  // Light bar on the roof: red on the left, blue on the right.
  const barBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.08, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.4, metalness: 0.6 })
  );
  barBase.position.set(0, 1.42, 0.1);
  mesh.add(barBase);
  const redMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xff2211, emissiveIntensity: 0.3 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x1122aa, emissive: 0x2255ff, emissiveIntensity: 0.3 });
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.26), redMat);
  red.position.set(-0.28, 1.52, 0.1);
  mesh.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.26), blueMat);
  blue.position.set(0.28, 1.52, 0.1);
  mesh.add(blue);

  // Flash glow pooled on the road under the car, alternating red/blue.
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 24),
    new THREE.MeshBasicMaterial({
      color: 0xff2211,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.09;
  mesh.add(glow);

  return { mesh, redMat, blueMat, glow };
}

function buildHelicopter() {
  const heli = new THREE.Group();
  heli.name = 'police-helicopter';
  const white = new THREE.MeshStandardMaterial({ color: 0xe8ecf0, roughness: 0.4, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a2a44, roughness: 0.5, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x10182a, roughness: 0.1, metalness: 0.8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 4.2), white);
  body.castShadow = true;
  heli.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 1.4), glass);
  nose.position.set(0, -0.1, -2.4);
  heli.add(nose);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.4, 4.24), dark);
  stripe.position.set(0, 0.1, 0);
  heli.add(stripe);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.6), white);
  tail.position.set(0, 0.3, 4.2);
  heli.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.4, 1.0), dark);
  fin.position.set(0, 0.9, 6.2);
  heli.add(fin);
  // Skids.
  for (const side of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), dark);
    skid.position.set(side * 1.1, -1.0, 0);
    heli.add(skid);
  }
  // Main rotor: two long blades on a mast, spinning fast.
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.1, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.6, 8), dark);
  rotor.add(mast);
  for (const side of [-1, 1]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.06, 0.34), dark);
    blade.position.set(side * 3.8, 0.3, 0);
    rotor.add(blade);
  }
  heli.add(rotor);
  // Tail rotor.
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.35, 0.9, 6.2);
  for (const side of [-1, 1]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.08), dark);
    blade.position.set(0, side * 0.8, 0);
    tailRotor.add(blade);
  }
  heli.add(tailRotor);

  // Searchlight: a real spotlight plus a visible cone and a pool of light
  // on the ground where it lands.
  const spot = new THREE.SpotLight(0xfff2c0, 900, 160, 0.24, 0.45, 1.2);
  heli.add(spot);
  heli.add(spot.target);
  const coneGeo = new THREE.ConeGeometry(1, 1, 20, 1, true);
  const cone = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({
      color: 0xfff2c0,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(7, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfff2c0,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.1;

  return { group: heli, rotor, tailRotor, spot, cone, pool };
}

export class PoliceSystem {
  constructor(scene, onBusted) {
    this.scene = scene;
    this.onBusted = onBusted;
    this.heat = 0;
    this.wanted = 0;
    this.bustTimer = 0;
    this.busted = false;
    this.time = 0;
    this.heliAngle = 0;

    this.cruisers = [];
    for (let i = 0; i < MAX_CRUISERS; i++) {
      const parts = buildCruiser();
      parts.mesh.visible = false;
      scene.add(parts.mesh);
      this.cruisers.push({
        ...parts,
        active: false,
        leaving: false,
        heading: 0,
        speed: 0,
        waypoint: new THREE.Vector3(),
        retargetTimer: 0,
      });
    }

    this.heli = buildHelicopter();
    this.heli.group.visible = false;
    scene.add(this.heli.group);
    scene.add(this.heli.cone);
    scene.add(this.heli.pool);
    this.heliActive = false;
    this.heliLeaving = false;

    // One shared flashing light that rides on the nearest active cruiser,
    // so the chase glows red and blue without a light per car.
    this.flashLight = new THREE.PointLight(0xff2211, 0, 26, 1.6);
    scene.add(this.flashLight);
  }

  get stars() {
    return this.wanted;
  }

  addHeat(amount) {
    if (this.busted) return;
    this.heat = Math.min(100, this.heat + amount);
    for (let s = 5; s > this.wanted; s--) {
      if (this.heat >= HEAT_FOR_STARS[s]) {
        this.wanted = s;
        break;
      }
    }
  }

  spawnCruiser(cruiser, playerPos) {
    // Appear on a road a little way off, never on top of the player.
    const angle = Math.random() * Math.PI * 2;
    const dist = 65 + Math.random() * 25;
    const x = Math.max(-140, Math.min(140, playerPos.x + Math.cos(angle) * dist));
    const z = Math.max(-140, Math.min(140, playerPos.z + Math.sin(angle) * dist));
    cruiser.mesh.position.set(snapRoad(x), 0, snapRoad(z));
    cruiser.heading = Math.atan2(-(playerPos.x - cruiser.mesh.position.x), -(playerPos.z - cruiser.mesh.position.z));
    cruiser.mesh.rotation.y = cruiser.heading;
    cruiser.mesh.visible = true;
    cruiser.active = true;
    cruiser.leaving = false;
    cruiser.speed = 8;
    cruiser.waypoint.set(playerPos.x, 0, playerPos.z);
    cruiser.retargetTimer = 0;
  }

  nearestCruiserDistance(playerPos) {
    let best = Infinity;
    for (const c of this.cruisers) {
      if (!c.active || c.wrecked) continue;
      const d = Math.hypot(c.mesh.position.x - playerPos.x, c.mesh.position.z - playerPos.z);
      if (d < best) best = d;
    }
    return best;
  }

  updateCruiser(c, dt, player, playerPos) {
    // A wrecked cruiser is dead where it stopped: no pursuit, no flash.
    if (c.wrecked) return;
    const pos = c.mesh.position;
    if (c.leaving) {
      // Drive away from the player, then disappear off the map.
      const dx = pos.x - playerPos.x;
      const dz = pos.z - playerPos.z;
      const d = Math.hypot(dx, dz) || 1;
      const want = Math.atan2(-dx / d, -dz / d);
      c.heading = this.steerToward(c.heading, want, 2.0 * dt);
      c.speed = Math.min(16, c.speed + 8 * dt);
      pos.x += -Math.sin(c.heading) * c.speed * dt;
      pos.z += -Math.cos(c.heading) * c.speed * dt;
      c.mesh.rotation.y = c.heading;
      if (d > 130) {
        c.active = false;
        c.leaving = false;
        c.mesh.visible = false;
      }
      return;
    }

    const distToPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
    let targetX = playerPos.x;
    let targetZ = playerPos.z;

    if (distToPlayer > 20) {
      // Manhattan pursuit on the road grid: head along the avenue with the
      // bigger gap first, so the cruiser stays on the asphalt.
      c.retargetTimer -= dt;
      if (c.retargetTimer <= 0) {
        c.retargetTimer = 0.6;
        if (Math.abs(playerPos.x - pos.x) > Math.abs(playerPos.z - pos.z)) {
          c.waypoint.set(snapRoad(playerPos.x), 0, snapRoad(pos.z));
        } else {
          c.waypoint.set(snapRoad(pos.x), 0, snapRoad(playerPos.z));
        }
      }
      targetX = c.waypoint.x;
      targetZ = c.waypoint.z;
      // Close enough to the waypoint: aim at the player directly.
      if (Math.hypot(targetX - pos.x, targetZ - pos.z) < 5) {
        targetX = playerPos.x;
        targetZ = playerPos.z;
      }
    } else if (Math.abs(player.speed) > 3) {
      // Close in: aim at a point ahead of the player to cut them off.
      const fx = -Math.sin(player.heading);
      const fz = -Math.cos(player.heading);
      targetX = playerPos.x + fx * 7;
      targetZ = playerPos.z + fz * 7;
    }

    const want = Math.atan2(-(targetX - pos.x), -(targetZ - pos.z));
    c.heading = this.steerToward(c.heading, want, 2.4 * dt);
    const cruise = Math.min(19, 12 + this.wanted * 1.4);
    const wantSpeed = distToPlayer < 6 ? 6 : cruise;
    c.speed += (wantSpeed - c.speed) * (1 - Math.exp(-2 * dt));
    pos.x += -Math.sin(c.heading) * c.speed * dt;
    pos.z += -Math.cos(c.heading) * c.speed * dt;
    c.mesh.rotation.y = c.heading;
  }

  steerToward(heading, want, maxTurn) {
    let diff = want - heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return heading + Math.max(-maxTurn, Math.min(maxTurn, diff));
  }

  updateHeli(dt, playerPos) {
    const heli = this.heli;
    if (!this.heliActive) return;
    this.heliAngle += dt * 0.22;
    const target = new THREE.Vector3(
      playerPos.x + Math.cos(this.heliAngle) * 26,
      40,
      playerPos.z + Math.sin(this.heliAngle) * 26
    );
    if (this.heliLeaving) {
      // Climb away and fade out once the chase is over.
      target.y = 90;
      target.x = playerPos.x + Math.cos(this.heliAngle) * 90;
      target.z = playerPos.z + Math.sin(this.heliAngle) * 90;
    }
    const k = 1 - Math.exp(-1.6 * dt);
    heli.group.position.lerp(target, k);
    heli.group.lookAt(playerPos.x, heli.group.position.y, playerPos.z);
    heli.rotor.rotation.y += dt * 26;
    heli.tailRotor.rotation.z += dt * 30;

    // Searchlight: the spotlight, the cone and the ground pool all track
    // the player.
    const ground = new THREE.Vector3(playerPos.x, 0, playerPos.z);
    heli.spot.position.set(0, -0.5, 0);
    heli.spot.target.position.copy(ground);
    heli.spot.target.updateMatrixWorld();
    const from = heli.group.position;
    const dir = new THREE.Vector3().subVectors(ground, from);
    const len = dir.length();
    heli.cone.position.copy(from).addScaledVector(dir, 0.5);
    heli.cone.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize().negate()
    );
    heli.cone.scale.set(5.5, len, 5.5);
    heli.cone.visible = !this.heliLeaving;
    heli.pool.position.set(ground.x, 0.1, ground.z);
    heli.pool.visible = !this.heliLeaving;

    if (this.heliLeaving && heli.group.position.y > 85) {
      this.heliActive = false;
      this.heliLeaving = false;
      heli.group.visible = false;
      heli.cone.visible = false;
      heli.pool.visible = false;
    }
  }

  update(dt, player) {
    this.time += dt;
    const playerPos = player.mesh.position;

    // Heat decays when the player breaks away; faster when out of sight
    // and slow, so hiding actually works.
    const nearest = this.nearestCruiserDistance(playerPos);
    if (this.wanted > 0 && !this.busted) {
      let decay = nearest > 80 ? 3 : 0.5;
      if (nearest > 80 && Math.abs(player.speed) < 2) decay = 6;
      this.heat = Math.max(0, this.heat - decay * dt);
      for (let s = this.wanted; s > 0; s--) {
        if (this.heat < HEAT_FOR_STARS[s] - 8) this.wanted = s - 1;
        else break;
      }
    }

    // Cruisers on duty match the wanted level.
    const wantCruisers = this.busted ? 0 : this.wanted;
    let active = 0;
    for (const c of this.cruisers) if (c.active && !c.leaving) active++;
    if (active < wantCruisers) {
      for (const c of this.cruisers) {
        if (active >= wantCruisers) break;
        if (!c.active) {
          this.spawnCruiser(c, playerPos);
          active++;
        }
      }
    }
    if (active > wantCruisers) {
      for (const c of this.cruisers) {
        if (active <= wantCruisers) break;
        if (c.active && !c.leaving) {
          c.leaving = true;
          active--;
        }
      }
    }

    // Helicopter joins at three stars.
    if (this.wanted >= 3 && !this.heliActive && !this.busted) {
      this.heliActive = true;
      this.heliLeaving = false;
      this.heli.group.visible = true;
      this.heli.group.position.set(playerPos.x + 26, 40, playerPos.z);
    }
    if (this.wanted < 3 && this.heliActive && !this.heliLeaving) {
      this.heliLeaving = true;
    }

    for (const c of this.cruisers) {
      if (!c.active) continue;
      this.updateCruiser(c, dt, player, playerPos);
    }

    // Flash the light bars: red and blue alternate, and the shared glow
    // light rides on the nearest cruiser.
    const phase = Math.floor(this.time * 5) % 2 === 0;
    let nearestCruiser = null;
    let nearestD = Infinity;
    for (const c of this.cruisers) {
      if (!c.active) continue;
      if (c.wrecked) {
        c.redMat.emissiveIntensity = 0;
        c.blueMat.emissiveIntensity = 0;
        c.glow.material.opacity = 0;
        continue;
      }
      c.redMat.emissiveIntensity = phase ? 3.2 : 0.25;
      c.blueMat.emissiveIntensity = phase ? 0.25 : 3.2;
      c.glow.material.color.setHex(phase ? 0xff2211 : 0x2255ff);
      c.glow.material.opacity = 0.16 + (phase ? 0.1 : 0);
      const d = Math.hypot(c.mesh.position.x - playerPos.x, c.mesh.position.z - playerPos.z);
      if (d < nearestD) {
        nearestD = d;
        nearestCruiser = c;
      }
    }
    if (nearestCruiser) {
      this.flashLight.position.set(
        nearestCruiser.mesh.position.x,
        3,
        nearestCruiser.mesh.position.z
      );
      this.flashLight.color.setHex(phase ? 0xff2211 : 0x2255ff);
      this.flashLight.intensity = 60;
    } else {
      this.flashLight.intensity = 0;
    }

    this.updateHeli(dt, playerPos);

    // Bust: slow, with a cruiser right on top of you, for three seconds.
    if (this.wanted > 0 && !this.busted) {
      if (Math.abs(player.speed) < 1.5 && nearest < 7) {
        this.bustTimer += dt;
        if (this.bustTimer >= BUST_TIME) {
          this.busted = true;
          this.wanted = 0;
          this.heat = 0;
          this.bustTimer = 0;
          for (const c of this.cruisers) if (c.active) c.leaving = true;
          if (this.heliActive) this.heliLeaving = true;
          if (this.onBusted) this.onBusted();
        }
      } else {
        this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
      }
    }
  }

  // Called after the bust overlay has been shown: the player is free to go.
  clearBusted() {
    this.busted = false;
  }
}
