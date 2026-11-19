// PELABUHAN SENJA — shot staging (part 4). No three.js import here: every
// 3D call goes through the api object main.js builds, so the pure helpers
// below stay Node-testable and this module never touches the network.
//
// The four shots (see SHOT_SPECS) are staged through the game's own debug
// handle: start the run, teleport the car / Raka / police / traffic to their
// marks, point a fixed staging camera, refresh the HUD once, then freeze the
// simulation so the frame the screenshot takes is exactly the staged one.
// Shot 4 plays the Lighthouse Run for real (teleport through its two stages)
// so the DELIVERY COMPLETE card is a genuine game state, not a mock.

export const SHOT_SPECS = [
  {
    n: 1, name: 'start', file: '1-start.jpg', fov: 57,
    desc: 'Low street-level title view down the avenue toward the sun; Raka readable.',
  },
  {
    n: 2, name: 'drive', file: '2-drive.jpg', fov: 40,
    desc: 'Low front-3/4 hero, long hood, Raka clearly readable in the brightened cabin.',
  },
  {
    n: 3, name: 'chase', file: '3-chase.jpg', fov: 55,
    desc: 'Low rear chase behind the truck, both interceptors separate, red traffic car.',
  },
  {
    n: 4, name: 'victory', file: '4-victory.jpg', fov: 57,
    desc: 'Low-angle up at Raka on the lighthouse hill, lamp room in frame.',
  },
];

// --- Pure helpers (Node-testable) -----------------------------------------

export function ndcInFrame(ndc, margin = 0.9) {
  return Math.abs(ndc.x) <= margin && Math.abs(ndc.y) <= margin && ndc.z < 1;
}

// True when two screen-space boxes (each {x, y, w, h} in NDC, centred) do
// not overlap — used for the interceptor-separation and card checks.
export function boxesDisjoint(a, b) {
  return Math.abs(a.x - b.x) * 2 >= a.w + b.w || Math.abs(a.y - b.y) * 2 >= a.h + b.h;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(cond, timeoutMs, label) {
  const start = Date.now();
  for (;;) {
    if (cond()) return;
    if (Date.now() - start > timeoutMs) throw new Error(`stage timeout: ${label}`);
    await sleep(120);
  }
}

// --- Staging ---------------------------------------------------------------

// Camera helper: eye sits a fixed height above the terrain at (x, z) so the
// shot survives the avenue's undulation; the look target is an absolute point.
function camAt(api, x, z, eye, tx, ty, tz, fov) {
  api.stageCam(x, api.heightAt(x, z) + eye, z, tx, ty, tz, fov);
}

export async function stageShot(n, api) {
  const spec = SHOT_SPECS.find((s) => s.n === n);
  if (!spec) throw new Error(`unknown shot ${n}`);
  api.clearStageCam();
  api.setFreeze(false);

  if (n === 1) {
    // Title screen, world rendering behind it. Raka stands on the avenue's
    // south edge ahead of the camera, facing it, big enough to read and
    // left of the centred title text.
    api.placeRaka(-62, -5.5, Math.PI / 2 + 0.3, false);
    camAt(api, -42, 0, 1.9, -80, -2, -30, spec.fov);
    api.setFreeze(true);
    return spec;
  }

  // Shots 2-4 play the game: start a NORMAL run first.
  api.startGame('NORMAL');
  await waitFor(() => api.phase() === 'playing', 30000, 'run to start');

  if (n === 2) {
    // Hero: the coupe on the avenue heading east, camera low at the front
    // left quarter so the long hood leads and the open tub shows Raka.
    api.setDrive(-20, 0, Math.PI / 2);
    const gy = api.heightAt(-20, 0);
    camAt(api, -13.5, 4.8, 1.35, -20.5, gy + 0.85, 0, spec.fov);
    api.refreshHUD();
    api.setFreeze(true);
    return spec;
  }

  if (n === 3) {
    // Chase: player car behind the truck on the avenue, both interceptors
    // staggered on opposite lanes, heat on so the light bars run hot.
    api.setWanted(2);
    api.setDrive(-60, 0, Math.PI / 2);
    api.setTrafficPos(2, -38, 0, Math.PI / 2); // truck, ahead centre
    api.setTrafficPos(1, -47, 0, Math.PI / 2); // red convertible, centre lane between player and truck
    api.setPolicePos(0, -48, -4.5, Math.PI / 2); // UNIT-7, left lane
    api.setPolicePos(1, -54, 4.5, Math.PI / 2); // TARPON-10, right lane
    api.setLightBarsHot();
    camAt(api, -72, 0, 2.0, -28, api.heightAt(-38, 0) + 1.6, 0, spec.fov);
    api.refreshHUD();
    api.setFreeze(true);
    return spec;
  }

  // Shot 4: play the Lighthouse Run for real. Teleport through both stages;
  // the second one completes the mission and raises the DELIVERY COMPLETE
  // card. Then Raka steps out onto the hill slope, arms raised, under the lamp.
  api.setMission(4);
  api.setDrive(78, -62, Math.PI / 2);
  await waitFor(() => api.game().stageIndex >= 1, 30000, 'hill-road stage');
  api.setDrive(105, -95, Math.PI / 2);
  await waitFor(() => api.phase() === 'card', 30000, 'lighthouse completion');
  api.hideDialogue();
  // Raka on the upper slope below the lamp, arms raised, facing the camera
  // down the hill. Camera close on the slope looking up: Raka reads big,
  // the lamp towers above him, and the hillside buildings stay out of frame.
  api.setFoot(100, -90, -0.62);
  api.placeRaka(100, -90, -0.62, true);
  camAt(api, 90, -76, 2.0, 95, 48, -105, spec.fov);
  api.refreshHUD();
  api.setFreeze(true);
  return spec;
}

// --- In-page assertions (browser only; api.THREE is the page's three) ------

function project(api, v) {
  const vec = new api.THREE.Vector3(v.x, v.y, v.z);
  vec.project(api.camera);
  return { x: vec.x, y: vec.y, z: vec.z };
}

function worldPosOf(api, obj, x = 0, y = 0, z = 0) {
  const v = new api.THREE.Vector3(x, y, z);
  obj.updateWorldMatrix(true, false);
  return obj.localToWorld(v);
}

// Raycast from the camera to a world point: clear when no OPAQUE object
// stands between (transparent glass, glow sprites and the beacon are ignored).
function raycastClear(api, target) {
  const from = api.camera.position.clone();
  const to = new api.THREE.Vector3(target.x, target.y, target.z);
  const dir = to.clone().sub(from);
  const dist = dir.length();
  dir.normalize();
  // Sprites (sun glow, light-bar halos) raycast against raycaster.camera,
  // and matrixWorlds must be current — refresh both before intersecting.
  api.scene.updateMatrixWorld(true);
  const ray = new api.THREE.Raycaster(from, dir, 0.1, dist + 5);
  ray.camera = api.camera;
  const hits = ray.intersectObjects(api.scene.children, true);
  for (const hit of hits) {
    let o = hit.object;
    let transparent = false;
    let selfHit = false;
    while (o) {
      if (o === api._targetRoot) { selfHit = true; break; }
      const m = o.material;
      if (m && m.transparent) { transparent = true; break; }
      o = o.parent;
    }
    if (selfHit) continue; // the target's own body never occludes itself
    if (transparent) continue;
    if (hit.distance < dist - 0.4) {
      return {
        clear: false, blocker: hit.object.type, at: +hit.distance.toFixed(1),
        dist: +dist.toFixed(1),
        point: [+hit.point.x.toFixed(1), +hit.point.y.toFixed(1), +hit.point.z.toFixed(1)],
      };
    }
  }
  return { clear: true, dist: +dist.toFixed(1) };
}

function ndcBox(api, centre, halfW, halfH) {
  const p = project(api, centre);
  return { ndc: p, box: { x: p.x, y: p.y, w: halfW * 2, h: halfH * 2 } };
}

export function assertShot(n, api) {
  const out = { shot: n, checks: {}, ndc: {} };
  const check = (name, ok, detail) => { out.checks[name] = { ok: !!ok, ...(detail ?? {}) }; };

  if (n === 1) {
    const head = worldPosOf(api, api.objects.raka, 0, 1.58, 0);
    const p = project(api, head);
    out.ndc.rakaHead = p;
    check('rakaInFrame', ndcInFrame(p, 0.85), p);
    check('rakaVisible', raycastClear(api, head).clear, raycastClear(api, head));
    const title = document.querySelector('.title-main');
    check('titleVisible', !!title && title.offsetParent !== null, {
      text: title ? title.textContent.replace(/\s+/g, ' ').trim() : null,
    });
    return out;
  }

  if (n === 2) {
    const driver = api.objects.driver;
    const head = worldPosOf(api, driver, 0, 1.02, 0.02);
    const p = project(api, head);
    out.ndc.driverHead = p;
    api._targetRoot = driver;
    const rc = raycastClear(api, head);
    api._targetRoot = null;
    check('driverInFrame', ndcInFrame(p, 0.85), p);
    check('driverVisible', rc.clear, rc);
    check('fov40', Math.abs(api.camera.fov - 40) < 1, { fov: api.camera.fov });
    const nose = worldPosOf(api, api.objects.coupe, 0, 0.7, 2.6);
    out.ndc.coupeNose = project(api, nose);
    check('noseInFrame', ndcInFrame(out.ndc.coupeNose, 0.9));
    return out;
  }

  if (n === 3) {
    const bars = [];
    for (let i = 0; i < 2; i += 1) {
      const bar = worldPosOf(api, api.objects.interceptors[i], 0, 1.2, -0.45);
      const p = project(api, bar);
      out.ndc[`interceptor${i}`] = p;
      check(`interceptor${i}InFrame`, ndcInFrame(p, 0.9), p);
      api._targetRoot = api.objects.interceptors[i];
      const rc = raycastClear(api, bar);
      api._targetRoot = null;
      check(`interceptor${i}Visible`, rc.clear, rc);
      bars.push({ x: p.x, y: p.y, w: 0.34, h: 0.2 });
    }
    check('interceptorsSeparate', boxesDisjoint(bars[0], bars[1]), {
      dx: +(bars[0].x - bars[1].x).toFixed(2),
    });
    const red = worldPosOf(api, api.objects.traffic[1], 0, 1.0, 0);
    out.ndc.redTraffic = project(api, red);
    check('redTrafficInFrame', ndcInFrame(out.ndc.redTraffic, 0.9));
    const truck = worldPosOf(api, api.objects.traffic[2], 0, 1.5, 0);
    out.ndc.truck = project(api, truck);
    check('truckInFrame', ndcInFrame(out.ndc.truck, 0.9));
    return out;
  }

  // Shot 4.
  const head = worldPosOf(api, api.objects.raka, 0, 1.58, 0);
  const p = project(api, head);
  out.ndc.rakaHead = p;
  check('rakaInFrame', ndcInFrame(p, 0.9), p);
  api._targetRoot = api.objects.raka;
  const rc = raycastClear(api, head);
  api._targetRoot = null;
  check('rakaVisible', rc.clear, rc);
  const lamp = api.lampPos();
  const lp = project(api, lamp);
  out.ndc.lampRoom = lp;
  check('lampInFrame', ndcInFrame(lp, 0.9), lp);
  const card = document.querySelector('.hud-center');
  const cardVisible = !!card && card.style.display !== 'none'
    && card.textContent.includes('DELIVERY COMPLETE');
  check('completeCardVisible', cardVisible);
  if (cardVisible && card) {
    // Both Raka and the lamp room must sit clear of the centred card rect.
    const r = card.getBoundingClientRect();
    const cardNdc = {
      x0: (r.left / window.innerWidth) * 2 - 1,
      x1: (r.right / window.innerWidth) * 2 - 1,
      y0: 1 - (r.bottom / window.innerHeight) * 2,
      y1: 1 - (r.top / window.innerHeight) * 2,
    };
    const outside = (q) => q.x < cardNdc.x0 || q.x > cardNdc.x1 || q.y < cardNdc.y0 || q.y > cardNdc.y1;
    check('rakaClearOfCard', outside(p), { x: +p.x.toFixed(2), y: +p.y.toFixed(2), cardNdc });
    check('lampClearOfCard', outside(lp), { x: +lp.x.toFixed(2), y: +lp.y.toFixed(2), cardNdc });
  } else {
    check('rakaClearOfCard', false, { reason: 'complete card missing' });
    check('lampClearOfCard', false, { reason: 'complete card missing' });
  }
  const mission = document.querySelector('.hud-mission');
  if (cardVisible && mission) {
    const a = card.getBoundingClientRect();
    const b = mission.getBoundingClientRect();
    const overlap = !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
    check('noCardOverlap', !overlap, {
      card: [Math.round(a.left), Math.round(a.top), Math.round(a.width), Math.round(a.height)],
      mission: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)],
    });
  } else {
    check('noCardOverlap', false, { reason: 'card or mission card missing' });
  }
  return out;
}
