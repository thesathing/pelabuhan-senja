// PELABUHAN SENJA — combat: shooting on foot and from the car.
//
// The player fires with F or a mouse click, from the car's nose while
// driving or from the avatar's shoulder on foot. A shot draws a tracer
// line and a muzzle flash, and with a little aim assist it can hit a
// police cruiser: enough hits wreck it — it stops dead, tilts, pours
// smoke, and the crew cheers the heat off. Wrecked cruisers are towed
// away after a few seconds, freeing the slot for a fresh pursuit car.
// Damage the player takes goes through missions.damage (armour first,
// then health), so combat and the wreck/bust flow share one ledger.

import * as THREE from '../vendor/three.module.min.js';

const RANGE = 70;
const DAMAGE_PER_HIT = 34;
const CRUISER_HP = 100;
const TRACER_LIFE = 0.35;
const WRECK_SMOKE_TIME = 9;
const AIM_DOT = 0.86;

function smokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(200, 200, 205, 0.85)');
  grad.addColorStop(0.6, 'rgba(120, 120, 128, 0.45)');
  grad.addColorStop(1, 'rgba(80, 80, 88, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export function makeOnFootAvatar() {
  const avatar = new THREE.Group();
  avatar.name = 'player-on-foot';
  const jacket = new THREE.MeshStandardMaterial({ color: 0xff6a1f, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23232e, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98e6a, roughness: 0.7 });

  // Torso: a capsule-ish body (cylinder + rounded shoulders), never a box.
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.72, 12), jacket);
  torso.position.y = 1.05;
  torso.castShadow = true;
  avatar.add(torso);
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8), jacket);
  shoulders.position.y = 1.38;
  shoulders.scale.set(1.15, 0.6, 0.9);
  avatar.add(shoulders);
  // Head with a flat cap.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 10), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  avatar.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.09, 12), dark);
  cap.position.y = 1.84;
  avatar.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.2), dark);
  brim.position.set(0, 1.8, -0.22);
  avatar.add(brim);
  // Legs.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.72, 8), dark);
    leg.position.set(side * 0.14, 0.36, 0);
    leg.castShadow = true;
    avatar.add(leg);
  }
  // Arms, one of them raised to hold the pistol forward.
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.6, 8), jacket);
  armL.position.set(-0.34, 1.1, 0);
  armL.rotation.z = 0.25;
  avatar.add(armL);
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.62, 8), jacket);
  armR.position.set(0.3, 1.22, -0.28);
  armR.rotation.x = Math.PI / 2.4;
  avatar.add(armR);
  return avatar;
}

export class CombatSystem {
  constructor(scene, police, missions, audio) {
    this.scene = scene;
    this.police = police;
    this.missions = missions;
    this.audio = audio;
    this.shotsFired = 0;
    this.hits = 0;
    this.wrecks = 0;
    this.time = 0;

    // Tracer pool: bright additive lines, one per recent shot.
    this.tracers = [];
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xffd27a,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      this.tracers.push({ line, life: 0 });
    }
    this._tracerNext = 0;

    // Muzzle flash: a hot core sphere plus a short-lived point light.
    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffdf8a,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.flash.visible = false;
    scene.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffc46b, 0, 10, 1.8);
    scene.add(this.flashLight);
    this._flashLife = 0;

    // Smoke pool: soft grey sprites that rise, grow and fade.
    this.smokeTex = smokeTexture();
    this.puffs = [];
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.smokeTex,
        color: 0x9a9aa2,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      scene.add(sprite);
      this.puffs.push({ sprite, life: 0, maxLife: 1.6, rise: 0 });
    }
    this._puffNext = 0;
    this._smokeTimer = 0;
  }

  // Pick the cruiser the shot is really aimed at: the nearest active one
  // inside range and inside a generous cone around the shot direction.
  pickTarget(origin, dir) {
    let best = null;
    let bestDist = RANGE;
    for (const c of this.police.cruisers) {
      if (!c.active || c.wrecked || c.leaving) continue;
      const to = new THREE.Vector3(
        c.mesh.position.x - origin.x,
        0.8 - origin.y,
        c.mesh.position.z - origin.z
      );
      const dist = to.length();
      if (dist > RANGE || dist < 1) continue;
      if (to.normalize().dot(dir) < AIM_DOT) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    return best ? { cruiser: best, dist: bestDist } : null;
  }

  // Fire one shot from `origin` along `dir` (both world space, dir unit).
  // Returns { hit, wrecked } so the caller and the tests can read it.
  fire(origin, dir) {
    this.shotsFired++;
    const pick = this.pickTarget(origin, dir);
    const end = new THREE.Vector3();
    if (pick) {
      end.set(pick.cruiser.mesh.position.x, 0.9, pick.cruiser.mesh.position.z);
    } else {
      end.copy(origin).addScaledVector(dir, RANGE);
      end.y = Math.max(0.4, end.y);
    }

    // Tracer from the muzzle to the impact point: two parallel lines, so
    // the beam reads even at a glance (and survives a slow screenshot).
    const perp = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(0.12);
    for (const offset of [new THREE.Vector3(0, 0, 0), perp]) {
      const slot = this.tracers[this._tracerNext];
      this._tracerNext = (this._tracerNext + 1) % this.tracers.length;
      const pos = slot.line.geometry.attributes.position;
      pos.setXYZ(0, origin.x + offset.x, origin.y + offset.y, origin.z + offset.z);
      pos.setXYZ(1, end.x + offset.x, end.y + offset.y, end.z + offset.z);
      pos.needsUpdate = true;
      slot.line.visible = true;
      slot.line.material.opacity = 0.95;
      slot.life = TRACER_LIFE;
    }

    // Muzzle flash at the gun.
    this.flash.position.copy(origin);
    this.flash.visible = true;
    this.flash.material.opacity = 1;
    this.flashLight.position.copy(origin);
    this.flashLight.intensity = 90;
    this._flashLife = 0.07;

    if (this.audio) this.audio.gunshot();

    if (!pick) return { hit: false, wrecked: false };
    this.hits++;
    const c = pick.cruiser;
    c.hp = (c.hp ?? CRUISER_HP) - DAMAGE_PER_HIT;
    if (c.hp > 0) {
      // A hit that does not wreck still rattles the cruiser and the crew.
      c.speed = Math.max(0, c.speed - 4);
      return { hit: true, wrecked: false };
    }
    this.wreckCruiser(c);
    return { hit: true, wrecked: true };
  }

  // A cruiser with no health left: dead stop, a list to one side, smoke,
  // lights out. It stops chasing (police.js skips wrecked cruisers) and is
  // towed away after WRECK_SMOKE_TIME seconds.
  wreckCruiser(c) {
    c.wrecked = true;
    c.hp = 0;
    c.speed = 0;
    c.wreckTimer = WRECK_SMOKE_TIME;
    c.mesh.rotation.z = 0.1;
    c.mesh.position.y = -0.12;
    c.redMat.emissiveIntensity = 0;
    c.blueMat.emissiveIntensity = 0;
    c.glow.material.opacity = 0;
    this.wrecks++;
    // Wrecking a cruiser cools the chase a little: the law regroups.
    this.police.heat = Math.max(0, this.police.heat - 15);
    if (this.missions) this.missions.say('SARI: "Cruiser itu hancur! Terus jalan, jangan berhenti!"');
    if (this.audio) this.audio.crash();
  }

  spawnPuff(x, y, z) {
    const puff = this.puffs[this._puffNext];
    this._puffNext = (this._puffNext + 1) % this.puffs.length;
    puff.sprite.position.set(x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.8);
    puff.sprite.scale.set(1.2, 1.2, 1);
    puff.sprite.material.opacity = 0.75;
    puff.sprite.visible = true;
    puff.life = puff.maxLife;
    puff.rise = 1.6 + Math.random() * 1.2;
  }

  update(dt) {
    this.time += dt;
    for (const slot of this.tracers) {
      if (slot.life <= 0) continue;
      slot.life -= dt;
      slot.line.material.opacity = Math.max(0, slot.life / TRACER_LIFE) * 0.95;
      if (slot.life <= 0) slot.line.visible = false;
    }
    if (this._flashLife > 0) {
      this._flashLife -= dt;
      const k = Math.max(0, this._flashLife / 0.07);
      this.flash.material.opacity = k;
      this.flashLight.intensity = 90 * k;
      this.flash.scale.setScalar(1 + (1 - k) * 0.6);
      if (this._flashLife <= 0) {
        this.flash.visible = false;
        this.flashLight.intensity = 0;
      }
    }
    // Wrecked cruisers pour smoke until they are towed away.
    this._smokeTimer -= dt;
    let smoking = false;
    for (const c of this.police.cruisers) {
      if (!c.active || !c.wrecked) continue;
      smoking = true;
      c.wreckTimer -= dt;
      if (c.wreckTimer <= 0) {
        c.active = false;
        c.wrecked = false;
        c.leaving = false;
        c.hp = CRUISER_HP;
        c.mesh.visible = false;
        c.mesh.rotation.z = 0;
        c.mesh.position.y = 0;
        continue;
      }
      if (this._smokeTimer <= 0) {
        this.spawnPuff(c.mesh.position.x, 1.6, c.mesh.position.z);
      }
    }
    if (smoking && this._smokeTimer <= 0) this._smokeTimer = 0.09;
    for (const puff of this.puffs) {
      if (puff.life <= 0) continue;
      puff.life -= dt;
      puff.sprite.position.y += puff.rise * dt;
      const age = 1 - puff.life / puff.maxLife;
      const s = 1.2 + age * 3.2;
      puff.sprite.scale.set(s, s, 1);
      puff.sprite.material.opacity = Math.max(0, 0.75 * (1 - age));
      if (puff.life <= 0) puff.sprite.visible = false;
    }
  }
}
