// PELABUHAN SENJA — boot, player, driving, traffic, police, pedestrians (part 2).
// Part 1's world viewer orbit is replaced by a playable third-person game:
// Raka drives the red GT coupe (WASD, Space handbrake, E exit/enter), two
// police interceptors ram-chase, traffic cruises the roads, pedestrians flee.
import * as THREE from './vendor/three.module.min.js';
import { buildWorld } from './world.js';
import { buildDetail } from './scene-detail.js';
import { heightAt, WORLD_DATA, ROADS, DISTRICTS, LIGHTHOUSE, mulberry32 } from './world-data.js';
import { DRIVING, fovForSpeed, shakeForSpeed, speedKmh, clamp } from './vehicle-data.js';
import {
  MISSIONS, DIFFICULTY, createGameState, startMission, updateMission, failMission,
  retryMission, nextMission, currentMission, currentStage, saveGame, loadGame,
  mapJobs, mapStats, fireWeapon, reloadWeapon, switchWeapon,
} from './missions.js';
import { createHUD, policeStatus } from './ui.js';
import { createAudioEngine } from './audio.js';
import {
  buildCoupe, buildInterceptor, buildRaka, buildTrafficCar,
} from './vehicles.js';
import {
  createCar, stepCar, createWalker, stepFoot, createPolice, stepPolice,
  createPed, stepPed, createTrafficCar, stepTraffic,
  resolveCarCollision, resolveCircleBuildings,
} from './driving.js';
import { stageShot, assertShot } from './shot-staging.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const hudEl = document.getElementById('hud');
const titleEl = document.getElementById('title');

// --- Game flow (part 3): title -> playing -> paused/map/card. ---
const audio = createAudioEngine();
let phase = 'title'; // 'title' | 'playing' | 'paused' | 'map' | 'card'
let game = createGameState('NORMAL');
let hudTimer = 0;
let hud = null;
let stageDialogueShown = false;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(57, window.innerWidth / window.innerHeight, 0.1, 2000);

const world = buildWorld();
scene.fog = world.fog;
scene.add(world.group);
const detail = buildDetail();
scene.add(detail.group);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Player: Raka in the red GT coupe, starting on the avenue heading east. ---
const car = createCar(-110, 0, Math.PI / 2);
const coupe = buildCoupe({ cabinLight: true });
scene.add(coupe.group);

const walker = createWalker(-108, 2, Math.PI / 2);
const raka = buildRaka();
raka.group.visible = false;
scene.add(raka.group);

let mode = 'drive'; // 'drive' | 'foot'

// --- Police: two interceptors that ram-chase the player when wanted > 0,
// parked at their home spots while the heat is off. ---
const police = [
  { state: createPolice(-92, 6, Math.PI / 2), mesh: buildInterceptor(), callsign: 'UNIT-7', home: { x: -92, z: 6 }, wasContact: false },
  { state: createPolice(-96, -6, Math.PI / 2), mesh: buildInterceptor(), callsign: 'TARPON-10', home: { x: -96, z: -6 }, wasContact: false },
];
for (const p of police) {
  p.state.callsign = p.callsign;
  scene.add(p.mesh.group);
}

// --- Traffic: six cars cruising the roads. ---
const TRAFFIC_COLORS = [0x4a5a6a, 0x9a2a2e, 0x5a6a4a, 0x7a6a5a, 0x3a4a5a, 0x8a7a5a];
const TRAFFIC_KINDS = ['coupe', 'convertible', 'truck', 'coupe', 'convertible', 'truck'];
const traffic = [];
for (let i = 0; i < 6; i += 1) {
  const state = createTrafficCar([0, 1, 2, 3, 4, 6][i], 0.1 + i * 0.13, 8 + (i % 3) * 2, i % 2 === 0 ? 1 : -1);
  stepTraffic(state, 0);
  const mesh = buildTrafficCar(TRAFFIC_KINDS[i], TRAFFIC_COLORS[i]);
  scene.add(mesh.group);
  traffic.push({ state, mesh });
}

// --- Pedestrians: ten walkers near the roads who flee the player. ---
const pedestrians = [];
{
  const random = mulberry32(20261119);
  for (let i = 0; i < 10; i += 1) {
    const road = ROADS[Math.floor(random() * ROADS.length)];
    const t = 0.1 + random() * 0.8;
    const angle = Math.atan2(road.bz - road.az, road.bx - road.ax);
    const nx = Math.sin(angle), nz = -Math.cos(angle);
    const side = random() < 0.5 ? -1 : 1;
    const x = road.ax + (road.bx - road.ax) * t + nx * side * (road.w / 2 + 2 + random() * 4);
    const z = road.az + (road.bz - road.az) * t + nz * side * (road.w / 2 + 2 + random() * 4);
    const state = createPed(x, z);
    const mesh = buildRaka();
    mesh.group.position.set(x, heightAt(x, z), z);
    scene.add(mesh.group);
    pedestrians.push({ state, mesh, legPhase: 0 });
  }
}

// --- Input: WASD + Shift + Space + E, pointer-lock mouse look. ---
const keys = new Set();
let orbitOffset = 0; // drive-mode camera orbit around the car (mouse)
let camYaw = Math.PI / 2; // foot-mode camera yaw
let camPitch = 0.32;
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyE') toggleEnterExit();
  if (e.code === 'Escape') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
    else if (phase === 'map') closeMap();
  }
  if (e.code === 'KeyM') {
    if (phase === 'playing') openMap();
    else if (phase === 'map') closeMap();
  }
  if (phase !== 'playing') return;
  if (e.code === 'KeyR' && reloadWeapon(game)) audio.blip();
  if (e.code === 'Digit1' && switchWeapon(game, 'FISTS')) audio.blip();
  if (e.code === 'Digit2' && switchWeapon(game, 'PISTOL')) audio.blip();
  if (e.code === 'Digit3' && switchWeapon(game, 'SMG')) audio.blip();
  if (e.code === 'KeyF') {
    if (game.weapon === 'FISTS') audio.blip(); // melee swing
    else fireShot();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
canvas.addEventListener('mousedown', () => {
  audio.unlock();
  if (phase !== 'playing') return;
  if (document.pointerLockElement !== canvas) {
    try { canvas.requestPointerLock(); } catch (err) { /* headless: no pointer lock */ }
    return;
  }
  fireShot();
});

function fireShot() {
  const res = fireWeapon(game);
  if (!res.fired) { audio.blip(); return; } // dry fire on an empty pistol
  if (game.weapon === 'PISTOL') audio.shot();
  else audio.blip(); // fists: a soft swing
}
canvas.addEventListener('click', () => {
  try { canvas.requestPointerLock(); } catch (err) { /* headless: no pointer lock */ }
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  if (mode === 'drive') {
    orbitOffset += e.movementX * 0.0035;
    camPitch = clamp(camPitch - e.movementY * 0.002, 0.1, 0.9);
  } else {
    camYaw -= e.movementX * 0.0025;
    camPitch = clamp(camPitch - e.movementY * 0.002, 0.1, 0.9);
  }
});

function toggleEnterExit() {
  if (mode === 'drive') {
    // Step out beside the car.
    mode = 'foot';
    walker.x = car.x - Math.cos(car.heading) * 2.2;
    walker.z = car.z + Math.sin(car.heading) * 2.2;
    walker.heading = car.heading;
    walker.y = 0;
    walker.grounded = true;
    camYaw = car.heading;
    raka.group.visible = true;
  } else {
    const d = Math.hypot(car.x - walker.x, car.z - walker.z);
    if (d < 4.5) {
      mode = 'drive';
      raka.group.visible = false;
      orbitOffset = 0;
    }
  }
}

function syncCarMesh(dt) {
  coupe.group.position.set(car.x, heightAt(car.x, car.z), car.z);
  coupe.group.rotation.y = car.heading;
  const spin = (car.speed * dt) / 0.38;
  for (const key of Object.keys(coupe.wheels)) {
    const w = coupe.wheels[key];
    w.spinner.rotation.x -= spin;
  }
  coupe.wheels.fl.pivot.rotation.y = car.steerAngle;
  coupe.wheels.fr.pivot.rotation.y = car.steerAngle;
  const brake = car.brakeLight ? 4.5 : 1.4;
  for (const m of coupe.brakeMats) m.emissiveIntensity = brake;
}

function syncWalkerMesh() {
  const y = heightAt(walker.x, walker.z) + (walker.y ?? 0);
  raka.group.position.set(walker.x, y, walker.z);
  raka.group.rotation.y = walker.heading;
  const swing = walker.moving ? Math.sin(walker.legPhase) * 0.55 : 0;
  raka.parts.legL.rotation.x = swing;
  raka.parts.legR.rotation.x = -swing;
  raka.parts.armL.rotation.x = -swing * 0.7;
  raka.parts.armR.rotation.x = swing * 0.7;
}

// --- Objective beacon: a gold pillar marking the current stage target. ---
const beaconGroup = new THREE.Group();
{
  const pillarMat = new THREE.MeshBasicMaterial({ color: 0xffd34e, transparent: true, opacity: 0.28 });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 7, 10), pillarMat);
  pillar.position.y = 3.5;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd34e, transparent: true, opacity: 0.85 });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.18, 24), ringMat);
  ring.position.y = 0.1;
  beaconGroup.add(pillar);
  beaconGroup.add(ring);
  beaconGroup.visible = false;
  scene.add(beaconGroup);
}

// --- HUD + game flow (part 3). ---
function missionCardData() {
  const m = currentMission(game);
  if (!m || !game.missionActive) {
    return {
      chapter: 'FREE ROAM', title: 'PELABUHAN SENJA',
      objective: game.allDone
        ? 'All missions complete. The city is yours.'
        : 'Pick a job from the city map [M].',
      stageLabel: game.allDone ? '5 / 5 DONE' : 'NO ACTIVE JOB',
      stageIndex: game.completed.length, stageTotal: MISSIONS.length, nextTitle: null,
    };
  }
  const stage = currentStage(game);
  const next = MISSIONS[game.missionIndex + 1];
  return {
    chapter: m.chapter, title: m.title, objective: m.objective,
    stageLabel: stage ? `${stage.label} — STAGE ${game.stageIndex + 1}/${m.stages.length}` : '—',
    stageIndex: game.stageIndex, stageTotal: m.stages.length,
    nextTitle: next ? next.title : null,
  };
}

function beginRun(state) {
  game = state;
  stageDialogueShown = false;
  if (!game.allDone) {
    startMission(game, game.missionIndex);
  } else {
    game.missionActive = false;
    game.wanted = 0;
  }
  audio.unlock();
  hud.hideTitle();
  hud.hideCards();
  hudEl.style.display = 'block';
  phase = 'playing';
  hud.setMission(missionCardData());
  hud.setRespect(game.respect);
  const m = currentMission(game);
  if (m && game.missionActive) hud.showDialogue(m.dialogue.start.speaker, m.dialogue.start.text);
  saveGame(game, window.localStorage);
}

function startGame(diff) { beginRun(createGameState(diff)); }

function continueGame() {
  const saved = loadGame(window.localStorage);
  if (!saved) { startGame('NORMAL'); return; }
  beginRun(saved);
}

function resumeGame() {
  hud.hideCards();
  phase = 'playing';
}

function pauseGame() {
  phase = 'paused';
  saveGame(game, window.localStorage);
  hud.showPause({
    onResume: () => { phase = 'playing'; },
    onRetry: () => { retryCurrent(); },
    onQuit: () => { quitToTitle(); },
  });
}

function retryCurrent() {
  stageDialogueShown = false;
  retryMission(game);
  hud.hideCards();
  phase = 'playing';
  hud.setMission(missionCardData());
  const m = currentMission(game);
  if (m) hud.showDialogue(m.dialogue.start.speaker, m.dialogue.start.text);
}

function quitToTitle() {
  saveGame(game, window.localStorage);
  hud.hideCards();
  hud.hideMap();
  hudEl.style.display = 'none';
  phase = 'title';
  hud.showTitle({ hasSave: !!loadGame(window.localStorage) });
}

function openMap() {
  phase = 'map';
  const playerPos = mode === 'drive' ? car : walker;
  hud.showMap({
    jobs: mapJobs(game), stats: mapStats(game), districts: DISTRICTS, roads: ROADS,
    playerX: playerPos.x, playerZ: playerPos.z, objective: currentStage(game),
  });
}

function closeMap() {
  hud.hideMap();
  phase = 'playing';
}

hud = createHUD({
  hudEl, titleEl,
  callbacks: {
    onStart: (diff) => { audio.blip(); startGame(diff); },
    onContinue: () => { audio.blip(); continueGame(); },
    onNext: () => {
      audio.blip();
      if (game.allDone) { phase = 'playing'; return; }
      stageDialogueShown = false;
      nextMission(game);
      phase = 'playing';
      hud.setMission(missionCardData());
      const m = currentMission(game);
      if (m) hud.showDialogue(m.dialogue.start.speaker, m.dialogue.start.text);
      saveGame(game, window.localStorage);
    },
    onRetry: () => { audio.blip(); retryCurrent(); },
    onQuit: () => { audio.blip(); quitToTitle(); },
    onCloseMap: () => { if (phase === 'map') phase = 'playing'; },
    blip: () => audio.blip(),
  },
});

// Title screen on load; the world renders behind it until the run starts.
hudEl.style.display = 'none';
hud.showTitle({ hasSave: !!loadGame(window.localStorage) });

// One HUD refresh pass (the 4 Hz block in frame(), factored out so shot
// staging can refresh the HUD once after placing everything).
function refreshHUD() {
  const playerPos = mode === 'drive' ? car : walker;
  const speed = mode === 'drive' ? car.speed : walker.speed;
  const stage = currentStage(game);
  hud.setPolice(
    police.map((p) => ({
      callsign: p.callsign,
      dist: p.state.dist,
      status: policeStatus(p.state, playerPos, game.wanted),
    })),
    game.wanted,
  );
  hud.setCash(game.cash, game.health, game.maxHealth, game.wanted);
  hud.setWeapons(game);
  hud.setSpeed(speedKmh(speed), mode === 'drive');
  hud.setRespect(game.respect);
  hud.setMission(missionCardData());
  hud.drawMinimap({
    playerX: playerPos.x, playerZ: playerPos.z, heading: playerPos.heading,
    police: police.map((p) => p.state),
    objective: stage, districts: DISTRICTS, roads: ROADS,
  });
}

// --- Shot staging (part 4): a fixed camera + a frozen simulation, so the
// screenshot frame is exactly the staged one. ---
let stageCam = null;
let stageFreeze = false;
function applyStageCam() {
  if (!stageCam) return;
  camera.position.set(stageCam.x, stageCam.y, stageCam.z);
  camera.lookAt(stageCam.tx, stageCam.ty, stageCam.tz);
  camera.fov = stageCam.fov;
  camera.updateProjectionMatrix();
}

function setFoot(x, z, heading) {
  mode = 'foot';
  walker.x = x; walker.z = z; walker.heading = heading;
  walker.y = 0; walker.grounded = true;
  raka.group.visible = true;
  syncWalkerMesh();
}

function setDrive(x, z, heading) {
  mode = 'drive';
  car.x = x; car.z = z; car.heading = heading;
  car.speed = 0;
  raka.group.visible = false;
  syncCarMesh(0);
}

// Place Raka's mesh directly (used on the title screen, where the frame loop
// never syncs the walker, and for the victory pose).
function placeRaka(x, z, heading, armsUp) {
  raka.group.visible = true;
  raka.group.position.set(x, heightAt(x, z), z);
  raka.group.rotation.y = heading;
  const raise = armsUp ? -2.7 : 0;
  raka.parts.armL.rotation.x = raise;
  raka.parts.armR.rotation.x = raise;
}

function setPolicePos(i, x, z, heading) {
  const p = police[i];
  if (!p) return;
  p.state.x = x; p.state.z = z; p.state.heading = heading;
  p.state.speed = 0;
  p.state.dist = Math.hypot(car.x - x, car.z - z);
  p.mesh.group.position.set(x, heightAt(x, z), z);
  p.mesh.group.rotation.y = heading;
}

function setTrafficPos(i, x, z, heading) {
  const tr = traffic[i];
  if (!tr) return;
  tr.state.x = x; tr.state.z = z; tr.state.heading = heading;
  tr.state.speed = 0;
  tr.mesh.group.position.set(x, heightAt(x, z), z);
  tr.mesh.group.rotation.y = heading;
}

function setLightBarsHot() {
  for (const p of police) {
    p.mesh.lightBar.redMat.emissiveIntensity = 3.5;
    p.mesh.lightBar.blueMat.emissiveIntensity = 3.5;
    if (p.mesh.lightBar.redGlow) p.mesh.lightBar.redGlow.material.opacity = 0.9;
    if (p.mesh.lightBar.blueGlow) p.mesh.lightBar.blueGlow.material.opacity = 0.9;
  }
}

const clock = new THREE.Clock();
let painted = 0;
const camPos = new THREE.Vector3(-100, 20, 20);
const camTarget = new THREE.Vector3();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  world.update(dt, camera);

  // Staged shot: simulation frozen, fixed camera — the frame is exactly
  // what staging placed.
  if (stageFreeze) {
    applyStageCam();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__worldReady = true;
      window.__playerReady = true;
    }
    requestAnimationFrame(frame);
    return;
  }

  // Title / pause / map / card: the world renders behind the overlay, frozen.
  if (phase !== 'playing') {
    applyStageCam();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__worldReady = true;
      window.__playerReady = true;
    }
    requestAnimationFrame(frame);
    return;
  }

  const playerPos = mode === 'drive' ? car : walker;

  if (mode === 'drive') {
    const input = {
      throttle: keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0,
      brake: keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0,
      steer: (keys.has('KeyA') || keys.has('ArrowLeft') ? -1 : 0)
        + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0),
      handbrake: keys.has('Space'),
    };
    stepCar(car, input, dt);
    resolveCarCollision(car, WORLD_DATA.buildings);
    if (car.hit) audio.impact();
    car.x = clamp(car.x, -148, 148);
    car.z = clamp(car.z, -138, 138);
    syncCarMesh(dt);
  } else {
    const input = {
      forward: keys.has('KeyW') || keys.has('ArrowUp'),
      back: keys.has('KeyS') || keys.has('ArrowDown'),
      left: keys.has('KeyA') || keys.has('ArrowLeft'),
      right: keys.has('KeyD') || keys.has('ArrowRight'),
      run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      hop: keys.has('Space'),
    };
    stepFoot(walker, input, dt, camYaw);
    resolveCircleBuildings(walker, 0.5, WORLD_DATA.buildings);
    walker.x = clamp(walker.x, -148, 148);
    walker.z = clamp(walker.z, -138, 138);
    syncWalkerMesh();
  }

  // Mission progress from the player position (car or on foot).
  if (game.missionActive) {
    const events = updateMission(game, playerPos, dt);
    for (const ev of events) {
      const mission = ev.mission;
      if (ev.type === 'stage') {
        audio.pickup();
        hud.setMission(missionCardData());
        if (mission.dialogue.stage && !stageDialogueShown) {
          stageDialogueShown = true;
          hud.showDialogue(mission.dialogue.stage.speaker, mission.dialogue.stage.text);
        }
      } else if (ev.type === 'complete') {
        audio.pickup();
        saveGame(game, window.localStorage);
        phase = 'card';
        hud.setMission(missionCardData());
        hud.setCash(game.cash, game.health, game.maxHealth, game.wanted);
        hud.setPolice([], game.wanted);
        hud.showDialogue(mission.dialogue.complete.speaker, mission.dialogue.complete.text);
        hud.showComplete({
          mission, cash: game.cash,
          nextTitle: MISSIONS[game.missionIndex + 1] ? MISSIONS[game.missionIndex + 1].title : null,
          allDone: game.allDone,
        });
      }
    }
  }

  // Police chase the player (car or on foot) and ram on contact — only while
  // wanted. With the heat off they stay parked at home, lights dim.
  for (const p of police) {
    if (game.wanted > 0) {
      stepPolice(p.state, playerPos, dt);
    } else {
      p.state.dist = Math.hypot(playerPos.x - p.state.x, playerPos.z - p.state.z);
      p.state.contact = false;
    }
    p.mesh.group.position.set(p.state.x, heightAt(p.state.x, p.state.z), p.state.z);
    p.mesh.group.rotation.y = p.state.heading;
    const spin = (p.state.speed * dt) / 0.38;
    for (const key of Object.keys(p.mesh.wheels)) p.mesh.wheels[key].spinner.rotation.x -= spin;
    // Light bar flashes: red and blue alternate twice a second (dim when parked).
    const redOn = Math.floor(t * 4) % 2 === 0;
    const hot = game.wanted > 0 ? 3.5 : 0.4;
    p.mesh.lightBar.redMat.emissiveIntensity = redOn ? hot : 0.4;
    p.mesh.lightBar.blueMat.emissiveIntensity = redOn ? 0.4 : hot;
    if (p.mesh.lightBar.redGlow) {
      p.mesh.lightBar.redGlow.material.opacity = game.wanted > 0 ? (redOn ? 0.9 : 0.15) : 0.1;
      p.mesh.lightBar.blueGlow.material.opacity = game.wanted > 0 ? (redOn ? 0.15 : 0.9) : 0.1;
    }
    if (p.state.contact) {
      if (!p.wasContact) audio.impact();
      // Ram: shove the player, bleed speed, drain health.
      game.health -= 14 * dt * DIFFICULTY[game.difficulty].ramDamage;
      if (mode === 'drive') car.speed *= 0.85;
      const dx = playerPos.x - p.state.x, dz = playerPos.z - p.state.z;
      const d = Math.hypot(dx, dz) || 1;
      playerPos.x += (dx / d) * 0.6;
      playerPos.z += (dz / d) * 0.6;
      if (game.health <= 0) {
        const failed = failMission(game, 'BUSTED');
        if (failed) {
          saveGame(game, window.localStorage);
          phase = 'card';
          hud.setCash(game.cash, game.health, game.maxHealth, game.wanted);
          hud.setPolice([], game.wanted);
          hud.showFailed(failed);
        }
      }
    }
    p.wasContact = p.state.contact;
  }

  // Traffic cruises; pedestrians wander and flee.
  for (const tr of traffic) {
    stepTraffic(tr.state, dt);
    tr.mesh.group.position.set(tr.state.x, heightAt(tr.state.x, tr.state.z), tr.state.z);
    tr.mesh.group.rotation.y = tr.state.heading;
    const spin = (tr.state.speed * dt) / (tr.mesh.spec.wheelRadius || 0.38);
    for (const key of Object.keys(tr.mesh.wheels)) tr.mesh.wheels[key].spinner.rotation.x -= spin;
  }
  for (const p of pedestrians) {
    stepPed(p.state, playerPos, dt, t);
    p.legPhase += p.state.speed * dt * 1.7;
    const swing = Math.sin(p.legPhase) * 0.5;
    p.mesh.group.position.set(p.state.x, heightAt(p.state.x, p.state.z), p.state.z);
    p.mesh.group.rotation.y = p.state.heading;
    p.mesh.parts.legL.rotation.x = swing;
    p.mesh.parts.legR.rotation.x = -swing;
  }

  // Camera: chase cam behind the car (drive) or behind Raka (foot), with the
  // FOV kick and shake above 60 km/h.
  const speed = mode === 'drive' ? car.speed : walker.speed;
  const targetFov = fovForSpeed(mode === 'drive' ? speed : 0);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5);
  camera.updateProjectionMatrix();
  const shake = shakeForSpeed(speed);
  const shX = shake ? (Math.random() - 0.5) * shake : 0;
  const shY = shake ? (Math.random() - 0.5) * shake : 0;
  if (mode === 'drive') {
    const yaw = car.heading + orbitOffset;
    const dist = 9.5, height = 3.2 + Math.sin(camPitch) * 2.5;
    const px = car.x - Math.sin(yaw) * dist;
    const pz = car.z - Math.cos(yaw) * dist;
    camPos.x += (px - camPos.x) * Math.min(1, dt * 6);
    camPos.y += ((heightAt(car.x, car.z) + height) - camPos.y) * Math.min(1, dt * 6);
    camPos.z += (pz - camPos.z) * Math.min(1, dt * 6);
    camTarget.set(
      car.x + Math.sin(car.heading) * 4,
      heightAt(car.x, car.z) + 1.2,
      car.z + Math.cos(car.heading) * 4,
    );
  } else {
    const dist = 5.5, height = 2.2 + Math.sin(camPitch) * 1.2;
    const px = walker.x - Math.sin(camYaw) * dist;
    const pz = walker.z - Math.cos(camYaw) * dist;
    camPos.x += (px - camPos.x) * Math.min(1, dt * 8);
    camPos.y += ((heightAt(walker.x, walker.z) + height) - camPos.y) * Math.min(1, dt * 8);
    camPos.z += (pz - camPos.z) * Math.min(1, dt * 8);
    camTarget.set(walker.x, heightAt(walker.x, walker.z) + 1.3, walker.z);
  }
  camera.position.set(camPos.x + shX, camPos.y + shY, camPos.z);
  camera.lookAt(camTarget);

  if (status) {
    const kmh = Math.round(speedKmh(speed));
    status.textContent = mode === 'drive'
      ? `DRIVE — ${kmh} km/h · WASD drive · Space handbrake · E exit`
      : `ON FOOT — ${kmh} km/h · WASD move · Shift run · Space hop · E enter car`;
  }

  // Audio follows the car: engine hum, siren while wanted, screech on drift.
  audio.setSpeed(mode === 'drive' ? car.speed : walker.speed);
  audio.setDriving(mode === 'drive');
  audio.setWanted(game.wanted);
  audio.setScreech(mode === 'drive' && car.screech);
  audio.update(t);

  // Objective beacon bobs over the current stage target.
  const stage = currentStage(game);
  if (stage && game.missionActive) {
    beaconGroup.visible = true;
    beaconGroup.position.set(stage.x, heightAt(stage.x, stage.z), stage.z);
    beaconGroup.position.y = heightAt(stage.x, stage.z) + Math.sin(t * 2) * 0.25;
  } else {
    beaconGroup.visible = false;
  }

  // HUD at 4 Hz (police list, cash, speed, minimap) — cheap DOM churn.
  hudTimer += dt;
  if (hudTimer > 0.25) {
    hudTimer = 0;
    refreshHUD();
  }

  renderer.render(scene, camera);
  painted += 1;
  if (painted === 2) {
    window.__worldReady = true;
    window.__playerReady = true;
  }
  requestAnimationFrame(frame);
}

// Debug handle for later parts (shot staging, missions): read-only state
// plus the staging calls part 4 needs (start, teleport, mission select).
window.__pelabuhan = {
  THREE, scene, camera,
  get mode() { return mode; },
  get phase() { return phase; },
  car, walker, police: police.map((p) => p.state), traffic: traffic.map((tr) => tr.state),
  get game() { return game; },
  missions: MISSIONS,
  startGame(diff) { startGame(diff); },
  teleport(x, z) {
    car.x = x; car.z = z;
    walker.x = x; walker.z = z;
    walker.y = 0; walker.grounded = true;
  },
  setMission(i) {
    stageDialogueShown = false;
    startMission(game, i);
    hud.setMission(missionCardData());
  },
  setWanted(n) { game.wanted = n; },
  setFoot, setDrive, placeRaka, setPolicePos, setTrafficPos, setLightBarsHot,
  hideDialogue() { hud.hideDialogue(); },
  refreshHUD,
  stageCam(x, y, z, tx, ty, tz, fov) { stageCam = { x, y, z, tx, ty, tz, fov }; },
  clearStageCam() { stageCam = null; },
  setFreeze(on) { stageFreeze = on; },
};

// Shot staging API (game/shot-staging.js): stage + assert the 4 screenshots.
const stageApi = {
  ...window.__pelabuhan,
  phase: () => phase,
  game: () => game,
  heightAt,
  objects: {
    raka: raka.group, rakaParts: raka.parts,
    coupe: coupe.group, driver: coupe.driver,
    interceptors: police.map((p) => p.mesh.group),
    traffic: traffic.map((tr) => tr.mesh.group),
  },
  lampPos() {
    return { x: LIGHTHOUSE.x, y: heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z) + 28, z: LIGHTHOUSE.z };
  },
};
window.__pelabuhan.stageShot = (n) => stageShot(n, stageApi);
window.__pelabuhan.assertShot = (n) => assertShot(n, stageApi);

requestAnimationFrame(frame);
