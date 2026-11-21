// PELABUHAN SENJA — bootstrap, game loop and driving.
//
// The entry point the page loads. It builds the renderer, the city, the
// player car and the traffic, then runs the loop: read the input, move the
// car with simple arcade physics, push it out of buildings, move the
// traffic along its loops, and let the chase camera follow. The game opens
// on a title screen (state 'menu'); Enter or a click starts driving.
//
// ?shot=<name> parks the car and the camera on one of the presets in
// shots.json, so screenshots are reproducible: chase, street, harbor, market.

import * as THREE from '../vendor/three.module.min.js';
import { CAMERA, CAR, PLAYER, WORLD } from './config.js';
import { Input } from './input.js';
import { ChaseCamera } from './render.js';
import { buildWorld } from './world.js';
import { makePlayerCar } from './vehicles.js';
import { TrafficSystem } from './traffic.js';
import { PedestrianSystem } from './pedestrians.js';
import { PoliceSystem } from './police.js';
import { MissionSystem } from './missions.js';
import { HUD } from './hud.js';
import { CombatSystem, makeOnFootAvatar } from './combat.js';
import { SaveSystem } from './save.js';
import { AudioEngine } from './audio.js';

// Camera presets for the screenshots (mirrors shots.json): where the car
// starts, which way it faces, and whether the camera chases or is parked.
const SHOTS = {
  chase: { car: { x: 0, z: 60, heading: 0 }, camera: { mode: 'chase', distance: 11, height: 4.5 } },
  street: { car: { x: 0, z: -18, heading: 0 }, camera: { mode: 'fixed', at: [0, 3.2, -32], look: [0, 1.5, -14] } },
  harbor: { car: { x: 84, z: 148, heading: 0 }, camera: { mode: 'fixed', at: [90, 4.5, 178], look: [90, 2, 142] } },
  market: { car: { x: -40, z: 0, heading: Math.PI / 2 }, camera: { mode: 'chase', distance: 16, height: 6 } },
};

const hud = new HUD();
const bustedOverlay = document.getElementById('busted');
const wreckedOverlay = document.getElementById('wrecked');
const menu = document.getElementById('menu');
const menuButton = document.getElementById('menu-start');
const pauseOverlay = document.getElementById('pause');
const pauseResumeBtn = document.getElementById('pause-resume');
const pauseSaveBtn = document.getElementById('pause-save');
const pauseMuteBtn = document.getElementById('pause-mute');
const pauseSavedEl = document.getElementById('pause-saved');
const crosshairEl = document.getElementById('crosshair');
const muteBadgeEl = document.getElementById('mute-badge');
let bustHideAt = 0;
let wreckHideAt = 0;
let paused = false;
let onFoot = false;
let walkSpeed = 0;
let walkPhase = 0;
let carParked = null;
let crosshairShown = false;

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('game') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CAMERA.baseFov, window.innerWidth / window.innerHeight, 0.1, 2000);

const world = buildWorld(scene);
const chase = new ChaseCamera(camera);
const input = new Input();

const player = {
  mesh: makePlayerCar(),
  x: PLAYER.startX,
  z: PLAYER.startZ,
  heading: PLAYER.startHeading,
  speed: 0,
  steer: 0,
};
scene.add(player.mesh);
player.mesh.position.set(player.x, 0, player.z);
player.mesh.rotation.y = player.heading;

// A warm fill light that rides just above and behind the player car, so the
// hero car always reads against the dusk — even deep in a building's shadow.
const heroLight = new THREE.PointLight(0xffc98a, 30, 22, 1.7);
scene.add(heroLight);

const traffic = new TrafficSystem(scene, world.loops);
const pedestrians = new PedestrianSystem(scene);
const police = new PoliceSystem(scene, () => {
  bustedOverlay.classList.remove('hidden');
  bustHideAt = performance.now() + 3000;
  hud.setHint('Kamu tertangkap — polisi membawamu ke kantor pos terdekat');
  missions.onBusted();
});
const missions = new MissionSystem(scene, police);
missions.onDialogue = (text) => hud.showDialogue(text);
missions.onWreck = () => {
  wreckedOverlay.classList.remove('hidden');
  wreckHideAt = performance.now() + 3000;
  respawnPlayer();
  hud.setHint('Mobil diganti — job diulang dari awal');
};
// A finished job pays out and saves immediately: the night is never lost
// to a closed tab.
missions.onComplete = (job) => {
  saveGame();
  hud.setHint(`JOB ${job.id} SELESAI — progres tersimpan +$${job.reward}`);
};

// Part D systems: synth audio, combat, and the on-foot avatar.
const audio = new AudioEngine();
const combat = new CombatSystem(scene, police, missions, audio);
const avatar = makeOnFootAvatar();
avatar.visible = false;
scene.add(avatar);

function updateMuteUI() {
  muteBadgeEl.classList.toggle('hidden', !audio.muted);
  pauseMuteBtn.textContent = audio.muted ? 'SUARA: MATI' : 'SUARA: NYALA';
}

function toggleMute() {
  audio.unlock();
  const muted = audio.toggleMute();
  updateMuteUI();
  return muted;
}

// The save record: cash, mission progress, health/armour, position, mute.
function saveGame() {
  return SaveSystem.save({
    cash: missions.cash,
    jobIndex: missions.jobIndex,
    allDone: missions.allDone,
    health: missions.health,
    armour: missions.armour,
    x: player.x,
    z: player.z,
    heading: player.heading,
    muted: audio.muted,
  });
}

function togglePause(force) {
  if (state !== 'driving') return;
  paused = force !== undefined ? force : !paused;
  pauseOverlay.classList.toggle('hidden', !paused);
  if (paused) {
    updateMuteUI();
    pauseSavedEl.classList.add('hidden');
  }
}

pauseResumeBtn.addEventListener('click', () => {
  audio.click();
  togglePause(false);
});
pauseSaveBtn.addEventListener('click', () => {
  audio.click();
  if (saveGame()) {
    pauseSavedEl.classList.remove('hidden');
    hud.setHint('Progres tersimpan — lanjutkan kapan saja');
  }
});
pauseMuteBtn.addEventListener('click', () => {
  toggleMute();
  audio.click();
});

// The player the camera, police and HUD follow: the car while driving,
// the avatar on foot.
function playerView() {
  if (onFoot) return { mesh: avatar, speed: walkSpeed, heading: player.heading };
  return player;
}

// Fire from the car nose (driving) or the avatar's shoulder (on foot),
// straight along the player's heading.
function fireFromPlayer() {
  const view = playerView();
  const fx = -Math.sin(player.heading);
  const fz = -Math.cos(player.heading);
  const origin = new THREE.Vector3(
    view.mesh.position.x + fx * 2.4,
    onFoot ? 1.45 : 1.2,
    view.mesh.position.z + fz * 2.4
  );
  const dir = new THREE.Vector3(fx, 0, fz);
  const result = combat.fire(origin, dir);
  if (result.wrecked) hud.setHint('Cruiser polisi hancur — asap mengepul di jalan');
  return result;
}

// E: step out of the car to walk the streets, or climb back in when close.
function toggleOnFoot() {
  if (state !== 'driving' || paused) return;
  if (!onFoot) {
    if (Math.abs(player.speed) > 2) {
      hud.setHint('Berhenti dulu sebelum keluar dari mobil');
      return;
    }
    onFoot = true;
    walkSpeed = 0;
    carParked = { x: player.x, z: player.z, heading: player.heading };
    avatar.visible = true;
    avatar.position.set(player.x, 0, player.z);
    avatar.rotation.y = player.heading;
    hud.setHint('Jalan kaki — WASD bergerak · F tembak · E kembali ke mobil');
  } else {
    const dx = player.x - carParked.x;
    const dz = player.z - carParked.z;
    if (Math.hypot(dx, dz) > 4.5) {
      hud.setHint('Kembali ke mobil untuk masuk — mobilmu terparkir di dekat sini');
      return;
    }
    onFoot = false;
    walkSpeed = 0;
    avatar.visible = false;
    player.x = carParked.x;
    player.z = carParked.z;
    player.heading = carParked.heading;
    player.speed = 0;
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.heading;
    hud.setHint('WASD mengemudi · F tembak · E jalan kaki · M bisu · Esc jeda');
  }
}

// Walking: same WASD feel as driving, at 5 m/s, with a small step bob.
function stepOnFoot(dt) {
  const throttle = input.throttleAxis();
  const steerInput = input.steerAxis();
  player.heading += steerInput * 2.2 * dt;
  const target = throttle * 5;
  walkSpeed += (target - walkSpeed) * (1 - Math.exp(-8 * dt));
  player.x += -Math.sin(player.heading) * walkSpeed * dt;
  player.z += -Math.cos(player.heading) * walkSpeed * dt;
  player.x = Math.max(-WORLD.halfSize - 4, Math.min(WORLD.halfSize + 4, player.x));
  player.z = Math.max(-WORLD.halfSize - 4, Math.min(WORLD.beachStart, player.z));
  walkPhase += Math.abs(walkSpeed) * dt * 2.4;
  avatar.position.set(player.x, Math.abs(Math.sin(walkPhase)) * 0.06, player.z);
  avatar.rotation.y = player.heading;
  if (input.resetPressed()) {
    player.x = carParked.x;
    player.z = carParked.z;
    player.heading = carParked.heading;
    walkSpeed = 0;
  }
}

// Put the car back at the start line, facing into the city.
function respawnPlayer() {
  player.x = PLAYER.startX;
  player.z = PLAYER.startZ;
  player.heading = PLAYER.startHeading;
  player.speed = 0;
  player.steer = 0;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
}

// Debug/test handle: the play-test drives the wanted level through this,
// teleports the car, fires the combat system, and reads the game state.
window.__senja = {
  police,
  traffic,
  pedestrians,
  missions,
  combat,
  audio,
  addHeat: (n) => police.addHeat(n),
  teleport: (x, z, heading) => {
    player.x = x;
    player.z = z;
    if (heading !== undefined) player.heading = heading;
    player.speed = 0;
    player.mesh.position.set(x, 0, z);
    player.mesh.rotation.y = player.heading;
  },
  // Park a cruiser right in front of the player (keeps the chase alive
  // first, so it does not immediately drive off).
  placeCruiserAhead: (dist = 18) => {
    police.addHeat(45);
    const c = police.cruisers.find((k) => !k.active) ?? police.cruisers[0];
    const fx = -Math.sin(player.heading);
    const fz = -Math.cos(player.heading);
    c.mesh.position.set(player.x + fx * dist, 0, player.z + fz * dist);
    c.heading = Math.atan2(-(player.x - c.mesh.position.x), -(player.z - c.mesh.position.z));
    c.mesh.rotation.y = c.heading;
    c.mesh.visible = true;
    c.active = true;
    c.leaving = false;
    c.wrecked = false;
    c.hp = 100;
    c.speed = 6;
    return c;
  },
  fire: () => fireFromPlayer(),
  // Snap the chase camera straight onto the car (after a teleport the
  // camera would otherwise glide across the whole city for seconds).
  snapCamera: () => {
    chase.snapped = false;
  },
  saveGame: () => saveGame(),
  loadSave: () => SaveSystem.load(),
  togglePause: (force) => togglePause(force),
  toggleOnFoot: () => toggleOnFoot(),
  getState: () => ({
    cash: missions.cash,
    jobIndex: missions.jobIndex,
    allDone: missions.allDone,
    health: missions.health,
    armour: missions.armour,
    stars: police.stars,
    activeCruisers: police.cruisers.filter((c) => c.active).length,
    heliActive: police.heliActive,
    shotsFired: combat.shotsFired,
    hits: combat.hits,
    wrecks: combat.wrecks,
    x: player.x,
    z: player.z,
    onFoot,
    paused,
    muted: audio.muted,
    audioReady: audio.ready,
  }),
};

// Apply a ?shot= preset before the first frame, so a screenshot URL opens
// already framed.
let state = 'menu';
const shotName = new URLSearchParams(window.location.search).get('shot');
const shot = SHOTS[shotName] ?? null;
// Resume a saved night when no ?shot= preset is given: cash, the job
// the night had reached, health/armour and the car's last position come
// back before the first briefing. A shot URL always starts fresh, so
// screenshots stay reproducible.
const savedGame = SaveSystem.load();
if (savedGame && !shot) {
  missions.restoreSave(savedGame);
  player.x = savedGame.x;
  player.z = savedGame.z;
  player.heading = savedGame.heading;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  audio.setMuted(savedGame.muted);
  updateMuteUI();
}
if (shot) {
  player.x = shot.car.x;
  player.z = shot.car.z;
  player.heading = shot.car.heading;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  if (shot.camera.mode === 'fixed') chase.setFixed(shot.camera.at, shot.camera.look);
  else chase.setChase(shot.camera.distance, shot.camera.height);
  // A shot URL opens already driving, so screenshots show the game itself,
  // not the title screen.
  state = 'driving';
  menu.classList.add('hidden');
  hud.setVisible(true);
  hud.setHint('WASD mengemudi · F tembak · E jalan kaki · M bisu · Esc jeda');
  missions.start();
}

function startDriving() {
  if (state === 'driving') return;
  state = 'driving';
  menu.classList.add('hidden');
  hud.setVisible(true);
  audio.unlock();
  audio.click();
  updateMuteUI();
  hud.setHint('WASD mengemudi · F tembak · E jalan kaki · M bisu · Esc jeda');
  missions.start();
}

menuButton.addEventListener('click', startDriving);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Enter') startDriving();
});

// Click (not drag) on the game canvas fires a shot while driving.
let mouseDownAt = null;
document.getElementById('game').addEventListener('mousedown', (event) => {
  mouseDownAt = { x: event.clientX, y: event.clientY };
});
document.getElementById('game').addEventListener('mouseup', (event) => {
  if (!mouseDownAt) return;
  const moved = Math.hypot(event.clientX - mouseDownAt.x, event.clientY - mouseDownAt.y);
  mouseDownAt = null;
  if (moved < 6 && state === 'driving' && !paused) {
    audio.unlock();
    fireFromPlayer();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Push the car out of a building's box (circle-vs-AABB on the ground plane)
// and bleed off speed on impact. A hard hit at speed damages the car.
function resolveCollisions() {
  const r = CAR.radius;
  const impactSpeed = Math.abs(player.speed);
  let hit = false;
  for (const box of world.colliders) {
    const nx = Math.max(box.minX, Math.min(player.x, box.maxX));
    const nz = Math.max(box.minZ, Math.min(player.z, box.maxZ));
    const dx = player.x - nx;
    const dz = player.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      player.x = nx + (dx / d) * r;
      player.z = nz + (dz / d) * r;
    } else {
      // Centre inside the box: push out along the shortest side.
      const left = player.x - box.minX;
      const right = box.maxX - player.x;
      const top = player.z - box.minZ;
      const bottom = box.maxZ - player.z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) player.x = box.minX - r;
      else if (m === right) player.x = box.maxX + r;
      else if (m === top) player.z = box.minZ - r;
      else player.z = box.maxZ + r;
    }
    player.speed *= 0.45;
  }
  if (hit && impactSpeed > 18) missions.damage(8);
  // Keep the car on the city slab, except for the pier corridor out to sea.
  const onPier = player.z > WORLD.beachStart && player.x > 84 && player.x < 96;
  player.x = Math.max(-WORLD.halfSize - 4, Math.min(WORLD.halfSize + 4, player.x));
  player.z = Math.max(-WORLD.halfSize - 4, Math.min(onPier ? 232 : WORLD.beachStart, player.z));
}

function stepDriving(dt) {
  const throttle = input.throttleAxis();
  const steerInput = input.steerAxis();
  const braking = input.braking();

  // Steering eases toward the player's input and fades at high speed.
  const steerTarget = steerInput * CAR.maxSteer * (1 - (Math.abs(player.speed) / CAR.maxSpeed) * 0.55);
  player.steer += (steerTarget - player.steer) * (1 - Math.exp(-10 * dt));

  if (throttle > 0) player.speed += CAR.accel * throttle * dt;
  if (throttle < 0) {
    if (player.speed > 0.5) player.speed += CAR.accel * throttle * dt * 1.4;
    else player.speed += CAR.reverseAccel * throttle * dt;
  }
  if (braking) {
    player.speed -= Math.sign(player.speed) * CAR.brake * dt;
    if (Math.abs(player.speed) < 0.4) player.speed = 0;
  }
  player.speed -= player.speed * CAR.drag * dt;
  player.speed -= Math.sign(player.speed) * Math.min(Math.abs(player.speed), CAR.rollingDrag * dt);
  player.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, player.speed));

  // Bicycle-ish turn: the heading follows the steered front wheels.
  player.heading += (player.speed / CAR.wheelBase) * Math.tan(player.steer) * dt;

  // Forward is (-sin h, 0, -cos h) — see vehicles.js for the convention.
  player.x += -Math.sin(player.heading) * player.speed * dt;
  player.z += -Math.cos(player.heading) * player.speed * dt;

  resolveCollisions();

  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;

  if (input.resetPressed()) {
    player.x = PLAYER.startX;
    player.z = PLAYER.startZ;
    player.heading = PLAYER.startHeading;
    player.speed = 0;
  }

  const drag = input.consumeDrag();
  if (drag.x !== 0 || drag.y !== 0) chase.addOrbit(drag.x, drag.y);
}

// Crime and heat: hitting traffic or a pedestrian, and reckless speeding,
// draw the law. Each source is throttled so one scrape is one offence.
function checkCrime(dt) {
  const px = player.x;
  const pz = player.z;
  for (const car of traffic.cars) {
    if (car.hitCooldown > 0) continue;
    const dx = car.mesh.position.x - px;
    const dz = car.mesh.position.z - pz;
    if (dx * dx + dz * dz < 3.4 * 3.4) {
      car.hitCooldown = 1.5;
      car.speed *= 0.3;
      player.speed *= 0.5;
      police.addHeat(12);
      missions.damage(12);
    }
  }
  const knocked = pedestrians.knockDownAt(px, pz, 1.8);
  if (knocked > 0) {
    player.speed *= 0.4;
    police.addHeat(18);
    missions.damage(10);
  }
  // Reckless speeding through the city draws attention on its own.
  if (Math.abs(player.speed) > 26) police.addHeat(2.5 * dt);
}

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  // Edge-triggered keys, read every frame while the game runs.
  if (input.consumePressed('KeyM')) toggleMute();
  if (state === 'driving' && input.consumePressed('Escape')) togglePause();
  if (!paused) {
    if (state === 'driving') {
      if (onFoot) stepOnFoot(dt);
      else stepDriving(dt);
      if (input.consumePressed('KeyF')) fireFromPlayer();
      if (input.consumePressed('KeyE')) toggleOnFoot();
      if (!onFoot) checkCrime(dt);
    }
    const view = playerView();
    traffic.update(dt, view.mesh.position);
    pedestrians.update(dt, view.mesh.position, view.speed);
    police.update(dt, view);
    combat.update(dt);
    audio.update(dt, {
      speed01: Math.abs(view.speed) / CAR.maxSpeed,
      wanted: police.stars,
    });
    chase.update(dt, view.mesh.position, player.heading, view.speed);
    heroLight.position.set(
      view.mesh.position.x + Math.sin(player.heading) * 3,
      5,
      view.mesh.position.z + Math.cos(player.heading) * 3
    );
    missions.update(dt, player);
  } else {
    audio.update(dt, { speed01: 0, wanted: 0 });
  }
  const showCrosshair = state === 'driving' && !paused;
  if (showCrosshair !== crosshairShown) {
    crosshairShown = showCrosshair;
    crosshairEl.classList.toggle('hidden', !showCrosshair);
  }
  const policeDots = [];
  for (const c of police.cruisers) {
    if (c.active) policeDots.push({ x: c.mesh.position.x, z: c.mesh.position.z });
  }
  hud.update(dt, {
    speedKmh: Math.abs(player.speed) * 3.6,
    cash: missions.cash,
    health: missions.health,
    armour: missions.armour,
    stars: police.stars,
    objective: missions.getObjective(),
    player: { x: player.x, z: player.z, heading: player.heading },
    policeDots,
    heli: police.heliActive
      ? { x: police.heli.group.position.x, z: police.heli.group.position.z }
      : null,
    target: missions.target,
  });
  if (bustHideAt > 0 && performance.now() > bustHideAt) {
    bustHideAt = 0;
    bustedOverlay.classList.add('hidden');
    police.clearBusted();
    hud.setHint('WASD mengemudi · Spasi rem · R kembali ke awal');
  }
  if (wreckHideAt > 0 && performance.now() > wreckHideAt) {
    wreckHideAt = 0;
    wreckedOverlay.classList.add('hidden');
  }
  renderer.render(scene, camera);
}

frame();
