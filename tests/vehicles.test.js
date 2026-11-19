// PELABUHAN SENJA — part 2 vehicle + driving contracts (Node, no browser).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COUPE, CONVERTIBLE, INTERCEPTOR, TRUCK, BUBBLE_TALL, BUBBLE_WHEELS,
  checkProportions, wheelBodyRatio, DRIVING, fovForSpeed, shakeForSpeed, speedKmh,
} from '../game/vehicle-data.js';
import {
  createCar, stepCar, createWalker, stepFoot, createPolice, stepPolice,
  createPed, stepPed, createTrafficCar, stepTraffic,
  resolveCarCollision, resolveCircleBuildings,
} from '../game/driving.js';
import { buildCoupe, buildConvertible, buildInterceptor, buildTruck, buildRaka } from '../game/vehicles.js';
import { isOnRoad } from '../game/world-data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

describe('sports-car proportion contract', () => {
  it('passes the GT coupe: 5.2 x 2.1, low roofline, long hood, big wheels', () => {
    assert.equal(COUPE.length, 5.2);
    assert.equal(COUPE.width, 2.1);
    assert.ok(COUPE.hood > COUPE.cabin, 'hood 2.1 longer than cabin 1.8');
    assert.ok(COUPE.roofline >= 0.9 && COUPE.roofline <= 1.15, `roofline ${COUPE.roofline}`);
    assert.equal(COUPE.wheelRadius, 0.38);
    assert.ok(wheelBodyRatio(COUPE) < 0.75, `ratio ${wheelBodyRatio(COUPE).toFixed(3)}`);
    assert.deepEqual(checkProportions(COUPE), { pass: true, failures: [] });
  });

  it('passes the convertible (open top + roll hoop) and the interceptor (light bar)', () => {
    assert.equal(checkProportions(CONVERTIBLE).pass, true);
    assert.equal(CONVERTIBLE.openTop, true);
    assert.equal(CONVERTIBLE.rollHoop, true);
    assert.equal(checkProportions(INTERCEPTOR).pass, true);
    assert.equal(INTERCEPTOR.lightBar, true);
  });

  it('passes the truck on its own contract: 0.52 wheels, wide cab, ribbed container', () => {
    assert.equal(TRUCK.wheelRadius, 0.52);
    assert.ok(TRUCK.width >= 2.3, 'wide cab');
    assert.ok(TRUCK.containerLength >= 4, 'long container');
    assert.deepEqual(checkProportions(TRUCK), { pass: true, failures: [] });
  });

  it('FAILS a tall bubble car (high roofline, short hood)', () => {
    const r = checkProportions(BUBBLE_TALL);
    assert.equal(r.pass, false);
    assert.ok(r.failures.some((f) => f.includes('roofline')), 'rejects the dome roofline');
    assert.ok(r.failures.some((f) => f.includes('hood')), 'rejects the short hood');
  });

  it('FAILS a car whose wheel/body ratio is >= 0.75', () => {
    assert.ok(wheelBodyRatio(BUBBLE_WHEELS) >= 0.75, `ratio ${wheelBodyRatio(BUBBLE_WHEELS).toFixed(3)}`);
    const r = checkProportions(BUBBLE_WHEELS);
    assert.equal(r.pass, false);
    assert.ok(r.failures.some((f) => f.includes('wheel/body ratio')), 'rejects oversized wheels');
  });
});

describe('driving model', () => {
  it('accelerates at 12/s^2 and caps at 23 m/s', () => {
    const car = createCar(0, 0, 0);
    for (let i = 0; i < 120; i += 1) stepCar(car, { throttle: 1, brake: 0, steer: 0, handbrake: false }, 1 / 60);
    assert.ok(car.speed > 22.5 && car.speed <= 23, `top speed ${car.speed}`);
    // It covers ground: ~2 s of accelerating from 0 averages ~11 m/s.
    assert.ok(car.z > 15, `travelled ${car.z.toFixed(1)} m`);
  });

  it('reverses to -9 m/s and brakes from speed', () => {
    const car = createCar(0, 0, 0);
    for (let i = 0; i < 120; i += 1) stepCar(car, { throttle: 0, brake: 1, steer: 0, handbrake: false }, 1 / 60);
    assert.ok(car.speed <= -8.5 && car.speed >= -9, `reverse ${car.speed}`);
    assert.equal(car.brakeLight, true);
    const fast = createCar(0, 0, 0);
    fast.speed = 20;
    stepCar(fast, { throttle: 0, brake: 1, steer: 0, handbrake: false }, 1);
    assert.ok(fast.speed < 3, `braked to ${fast.speed}`);
    assert.equal(fast.brakeLight, true);
  });

  it('steers less at speed and drifts with yaw x2.1 on handbrake', () => {
    // Speed-scaled steering: the steer ANGLE shrinks with speed, so the
    // turning radius grows even though the yaw rate itself rises.
    const slow = createCar(0, 0, 0);
    slow.speed = 5;
    stepCar(slow, { throttle: 0, brake: 0, steer: 1, handbrake: false }, 0.5);
    const fast = createCar(0, 0, 0);
    fast.speed = 20;
    stepCar(fast, { throttle: 0, brake: 0, steer: 1, handbrake: false }, 0.5);
    assert.ok(fast.steerAngle < slow.steerAngle,
      `steer angle falls with speed (${fast.steerAngle.toFixed(3)} < ${slow.steerAngle.toFixed(3)})`);
    const radiusSlow = 5 / (slow.heading / 0.5);
    const radiusFast = 20 / (fast.heading / 0.5);
    assert.ok(radiusFast > radiusSlow, `turn radius grows with speed (${radiusFast.toFixed(1)} > ${radiusSlow.toFixed(1)})`);
    // Drift: same speed and steer, one short step, handbrake multiplies yaw x2.1.
    const drift = createCar(0, 0, 0);
    drift.speed = 15;
    stepCar(drift, { throttle: 0, brake: 0, steer: 1, handbrake: true }, 1 / 60);
    const plain = createCar(0, 0, 0);
    plain.speed = 15;
    stepCar(plain, { throttle: 0, brake: 0, steer: 1, handbrake: false }, 1 / 60);
    assert.ok(Math.abs((drift.heading / plain.heading) - DRIVING.driftYawMult) < 0.25,
      `drift yaw x${(drift.heading / plain.heading).toFixed(2)} (want x2.1)`);
    assert.equal(drift.screech, true, 'handbrake at speed screeches');
    assert.equal(plain.screech, false, 'no screech without handbrake');
  });

  it('kicks the FOV 57 -> 64 and shakes only above 60 km/h', () => {
    assert.equal(fovForSpeed(0), 57);
    assert.equal(fovForSpeed(DRIVING.maxSpeed), 64);
    assert.ok(fovForSpeed(11.5) > 57 && fovForSpeed(11.5) < 64, 'mid-speed FOV is between');
    assert.equal(shakeForSpeed(10), 0, 'no shake at 36 km/h');
    assert.equal(shakeForSpeed(16), 0, 'no shake below 60 km/h');
    assert.ok(shakeForSpeed(20) > 0, 'shake above 60 km/h');
    assert.ok(shakeForSpeed(DRIVING.maxSpeed) > shakeForSpeed(20), 'shake grows with speed');
    assert.equal(Math.round(speedKmh(23)), 83, '23 m/s is ~83 km/h');
  });

  it('walks at 5.5 and runs at 9, hops and lands', () => {
    const w = createWalker(0, 0, 0);
    stepFoot(w, { forward: true, run: false }, 1, 0);
    assert.ok(Math.abs(w.z - 5.5) < 0.01, `walk ${w.z}`);
    const r = createWalker(0, 0, 0);
    stepFoot(r, { forward: true, run: true }, 1, 0);
    assert.ok(Math.abs(r.z - 9) < 0.01, `run ${r.z}`);
    const h = createWalker(0, 0, 0);
    stepFoot(h, { hop: true }, 1 / 60);
    assert.equal(h.grounded, false, 'hop leaves the ground');
    for (let i = 0; i < 120; i += 1) stepFoot(h, {}, 1 / 60);
    assert.equal(h.grounded, true, 'lands again');
    assert.equal(h.y, 0, 'back on the ground');
  });
});

describe('police chase AI and pedestrians', () => {
  it('police turn toward the target, close in, and ram on contact', () => {
    const p = createPolice(0, 0, 0);
    const target = { x: 20, z: 0 };
    const d0 = Math.hypot(target.x - p.x, target.z - p.z);
    for (let i = 0; i < 120; i += 1) stepPolice(p, target, 1 / 60);
    assert.ok(p.dist < d0, `closed from ${d0} to ${p.dist.toFixed(1)}`);
    assert.ok(p.heading > 0.5, `turned toward target (${p.heading.toFixed(2)} rad)`);
    const close = createPolice(2, 0, 0);
    stepPolice(close, { x: 0, z: 0 }, 1 / 60);
    assert.equal(close.contact, true, 'contact inside the ram distance');
  });

  it('pedestrians flee a nearby threat and wander otherwise', () => {
    const ped = createPed(0, 0);
    stepPed(ped, { x: 5, z: 0 }, 1, 0);
    assert.equal(ped.fleeing, true, 'flees inside 12 m');
    assert.ok(ped.x < 0, `runs away from the threat (x=${ped.x.toFixed(1)})`);
    assert.ok(Math.abs(ped.speed - DRIVING.pedFleeSpeed) < 0.01, 'flee speed 4.2');
    const calm = createPed(0, 0);
    stepPed(calm, { x: 50, z: 0 }, 1, 0);
    assert.equal(calm.fleeing, false, 'calm beyond 12 m');
    assert.ok(Math.abs(calm.speed - DRIVING.pedWanderSpeed) < 0.01, 'wander speed 1.2');
  });

  it('traffic stays on its road and wraps at the ends', () => {
    const car = createTrafficCar(0, 0.5, 10, 1);
    stepTraffic(car, 0);
    assert.ok(isOnRoad(car.x, car.z), 'traffic sits on the avenue');
    const t0 = car.t;
    stepTraffic(car, 5);
    assert.ok(car.t > t0, 'advances along the road');
    assert.ok(isOnRoad(car.x, car.z), 'still on the road after moving');
    const wrap = createTrafficCar(0, 0.97, 10, 1);
    stepTraffic(wrap, 2);
    assert.ok(wrap.t < 0.1, `wraps around (t=${wrap.t.toFixed(2)})`);
  });

  it('collisions bounce the car and push walkers out of buildings', () => {
    const building = { x: 0, z: 0, w: 10, d: 10, h: 10, rot: 0 };
    const car = createCar(4.5, 0, 0);
    car.speed = 10;
    const hit = resolveCarCollision(car, [building]);
    assert.equal(hit, true, 'car hits the building');
    assert.ok(car.x > 5, `pushed out to x=${car.x.toFixed(1)}`);
    assert.ok(car.speed < 0, `bounces back (${car.speed.toFixed(1)})`);
    const walker = { x: 4.5, z: 0 };
    assert.equal(resolveCircleBuildings(walker, 0.5, [building]), true);
    assert.ok(walker.x > 5, 'walker pushed out');
  });
});

describe('three.js vehicle builders (Node smoke)', () => {
  it('builds a coupe with 4 wheels, a visible driver and brake lights', () => {
    const c = buildCoupe({ cabinLight: false });
    assert.equal(Object.keys(c.wheels).length, 4);
    assert.ok(c.driver, 'driver present in the tub');
    assert.ok(c.brakeMats.length >= 1, 'taillight bar present');
    assert.ok(c.group.children.length > 30, 'detailed body');
  });

  it('builds a convertible with a roll hoop and no roof, an interceptor with a light bar, a 6-wheel truck', () => {
    const v = buildConvertible();
    assert.ok(v.group.children.length > 30, 'convertible detailed');
    const i = buildInterceptor();
    assert.ok(i.lightBar, 'light bar present');
    assert.equal(i.lightBar.redMat.emissiveIntensity, 3.0, 'hot red segment');
    assert.equal(i.lightBar.blueMat.emissiveIntensity, 3.0, 'hot blue segment');
    const t = buildTruck();
    assert.equal(Object.keys(t.wheels).length, 6, 'truck has 6 wheels');
    assert.ok(t.spec.wheelRadius === 0.52, 'truck wheels 0.52');
  });

  it('builds a standing Raka with pivoted limbs for the walk animation', () => {
    const r = buildRaka();
    assert.deepEqual(Object.keys(r.parts).sort(), ['armL', 'armR', 'head', 'legL', 'legR', 'torso'].sort());
  });
});

describe('world lighting (part 2 fix)', () => {
  it('builds the lights onto the returned group, not a private scene', () => {
    const world = read('game/world.js');
    assert.ok(!world.includes('new THREE.Scene()'), 'no private inner scene');
    assert.ok(world.includes('group.add(hemi)'), 'hemisphere light on the group');
    assert.ok(world.includes('group.add(new THREE.AmbientLight'), 'ambient light on the group');
    assert.ok(world.includes('group.add(sunLight)'), 'sun on the group');
    assert.ok(world.includes('group.add(fill)'), 'fill light on the group');
    assert.ok(/return \{ group, update, data, fog \}/.test(world), 'fog is returned');
    const main = read('game/main.js');
    assert.ok(main.includes('scene.fog = world.fog'), 'main scene adopts the fog');
  });
});

describe('main.js wiring', () => {
  it('imports the vehicle + driving modules and has no network URL', () => {
    const main = read('game/main.js');
    assert.ok(main.includes("from './vehicles.js'"), 'imports vehicles');
    assert.ok(main.includes("from './driving.js'"), 'imports driving');
    assert.ok(main.includes("from './vehicle-data.js'"), 'imports vehicle data');
    assert.ok(!/https?:\/\//.test(main), 'main.js has no network URL');
    assert.ok(main.includes('requestPointerLock'), 'pointer-lock mouse look');
    assert.ok(main.includes('__playerReady'), 'exposes the player-ready flag');
  });

  it('has no referral code in the new part-2 game files', () => {
    for (const p of ['game/vehicle-data.js', 'game/driving.js', 'game/vehicles.js', 'game/main.js']) {
      assert.ok(!/referral|utm_source|wftbn3z4/i.test(read(p)), `${p} is referral-free`);
    }
  });
});
