// PELABUHAN SENJA — pure driving model (no three.js import, Node-testable).
// State is plain objects; the three.js layer (main.js) copies positions and
// headings onto meshes each frame. Forward is (sin(heading), cos(heading)).

import { DRIVING, clamp } from './vehicle-data.js';
import { ROADS as WORLD_ROADS, heightAt, roadDistance } from './world-data.js';

export function createCar(x, z, heading = 0, spec = null) {
  return {
    x, z, heading, speed: 0, steerAngle: 0,
    handbrake: false, screech: false, brakeLight: false, drifting: false,
    spec, hit: false,
  };
}

// input: { throttle: 0|1, brake: 0|1, steer: -1..1 (left -, right +), handbrake: bool }
export function stepCar(car, input, dt) {
  const D = DRIVING;
  if (input.throttle) {
    car.speed += D.accel * dt;
    if (car.speed > D.maxSpeed) car.speed = D.maxSpeed;
  }
  if (input.brake) {
    if (car.speed > 0.5) {
      car.speed -= D.brake * dt;
      if (car.speed < 0) car.speed = 0;
    } else {
      car.speed -= D.accel * 0.6 * dt;
      if (car.speed < D.maxReverse) car.speed = D.maxReverse;
    }
  }
  if (!input.throttle && !input.brake) {
    // Coast drag toward 0.
    const drag = D.drag * dt;
    car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
  }
  car.handbrake = !!input.handbrake;
  if (car.handbrake) {
    car.speed *= Math.exp(-D.handbrakeDrag * dt);
  }

  // Speed-scaled steering; handbrake multiplies the yaw rate (rear slip).
  const maxSteer = D.maxSteer / (1 + Math.abs(car.speed) * D.steerFalloff);
  car.steerAngle = clamp(input.steer || 0, -1, 1) * maxSteer;
  let yawRate = (car.speed / D.wheelbase) * Math.tan(car.steerAngle);
  car.drifting = car.handbrake && Math.abs(car.speed) > 4;
  if (car.drifting) yawRate *= D.driftYawMult;
  car.heading += yawRate * dt;
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;

  car.screech = car.drifting || (car.handbrake && Math.abs(car.speed) > 5);
  car.brakeLight = !!input.brake || car.speed < -0.5;
  car.hit = false;
  return car;
}

export function createWalker(x, z, heading = 0) {
  return {
    x, z, heading, vy: 0, grounded: true,
    speed: 0, legPhase: 0, moving: false,
  };
}

// input: { forward, back, left, right, run, hop } — movement relative to heading.
export function stepFoot(w, input, dt, cameraYaw = null) {
  const D = DRIVING;
  const yaw = cameraYaw === null ? w.heading : cameraYaw;
  let mx = 0, mz = 0;
  if (input.forward) { mx += Math.sin(yaw); mz += Math.cos(yaw); }
  if (input.back) { mx -= Math.sin(yaw); mz -= Math.cos(yaw); }
  if (input.left) { mx -= Math.cos(yaw); mz += Math.sin(yaw); }
  if (input.right) { mx += Math.cos(yaw); mz -= Math.sin(yaw); }
  const len = Math.hypot(mx, mz);
  w.moving = len > 0;
  if (w.moving) {
    const target = input.run ? D.runSpeed : D.walkSpeed;
    w.speed = target;
    w.x += (mx / len) * target * dt;
    w.z += (mz / len) * target * dt;
    // Face the direction of travel.
    w.heading = Math.atan2(mx / len, mz / len);
    w.legPhase += target * dt * 1.7;
  } else {
    w.speed = 0;
  }
  // Hop: vertical velocity + gravity, grounded on the terrain height passed in
  // by the caller through w.groundY (main.js sets it each frame).
  if (input.hop && w.grounded) {
    w.vy = D.hopVelocity;
    w.grounded = false;
  }
  if (!w.grounded) {
    w.vy -= D.gravity * dt;
    w.y = (w.y ?? 0) + w.vy * dt;
    if (w.y <= 0) { w.y = 0; w.vy = 0; w.grounded = true; }
  }
  return w;
}

// --- Police chase AI: steers toward the target and rams on contact. ---
export function createPolice(x, z, heading = 0) {
  return { x, z, heading, speed: 0, contact: false, dist: Infinity, callsign: 'UNIT-7' };
}

export function stepPolice(p, target, dt) {
  const D = DRIVING;
  const dx = target.x - p.x, dz = target.z - p.z;
  p.dist = Math.hypot(dx, dz);
  const desired = Math.atan2(dx, dz);
  let diff = desired - p.heading;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const turn = clamp(diff, -D.policeTurnRate * dt, D.policeTurnRate * dt);
  p.heading += turn;
  p.speed += (D.policeMaxSpeed - p.speed) * Math.min(1, dt * 0.8);
  p.x += Math.sin(p.heading) * p.speed * dt;
  p.z += Math.cos(p.heading) * p.speed * dt;
  p.contact = p.dist < D.policeRamDistance;
  return p;
}

// --- Pedestrians: wander, flee from a threat within the flee radius. ---
export function createPed(x, z) {
  return { x, z, heading: Math.random() * Math.PI * 2, speed: 0, fleeing: false, seed: Math.random() * 10 };
}

export function stepPed(p, threat, dt, time = 0) {
  const D = DRIVING;
  const dx = p.x - threat.x, dz = p.z - threat.z;
  const dist = Math.hypot(dx, dz);
  if (dist < D.pedFleeRadius) {
    p.fleeing = true;
    p.heading = Math.atan2(dx, dz);
    p.speed = D.pedFleeSpeed;
  } else {
    p.fleeing = false;
    p.speed = D.pedWanderSpeed;
    p.heading += Math.sin(time * 0.3 + p.seed) * dt * 0.4;
  }
  p.x += Math.sin(p.heading) * p.speed * dt;
  p.z += Math.cos(p.heading) * p.speed * dt;
  return p;
}

// --- Traffic: cars that cruise along road segments and wrap at the ends. ---
export function createTrafficCar(roadIndex, t, speed, dir = 1) {
  const road = WORLD_ROADS[roadIndex % WORLD_ROADS.length];
  return { road, t, speed, dir, x: 0, z: 0, heading: 0 };
}

export function stepTraffic(car, dt) {
  const r = car.road;
  const len = Math.hypot(r.bx - r.ax, r.bz - r.az);
  car.t += (car.dir * car.speed * dt) / len;
  if (car.t > 0.98) car.t = 0.02;
  if (car.t < 0.02) car.t = 0.98;
  const lane = (car.dir > 0 ? 1.8 : -1.8);
  const angle = Math.atan2(r.bz - r.az, r.bx - r.ax);
  const nx = Math.sin(angle), nz = -Math.cos(angle);
  car.x = r.ax + (r.bx - r.ax) * car.t + nx * lane;
  car.z = r.az + (r.bz - r.az) * car.t + nz * lane;
  const base = Math.atan2(r.bx - r.ax, r.bz - r.az);
  car.heading = car.dir > 0 ? base : base + Math.PI;
  return car;
}

// --- Collisions: car / walker circles against building AABBs. ---
// Buildings are rotated 0 or PI/2, so the AABB is just w/d swapped when rotated.
function buildingAABB(b) {
  const w = Math.abs(Math.cos(b.rot)) > 0.5 ? b.w : b.d;
  const d = Math.abs(Math.cos(b.rot)) > 0.5 ? b.d : b.w;
  return { x1: b.x - w / 2, x2: b.x + w / 2, z1: b.z - d / 2, z2: b.z + d / 2 };
}

export function resolveCircleBuildings(entity, radius, buildings) {
  let hit = false;
  for (const b of buildings) {
    // Cheap reject: skip buildings far away.
    if (Math.abs(b.x - entity.x) > 30 || Math.abs(b.z - entity.z) > 30) continue;
    const a = buildingAABB(b);
    const cx = clamp(entity.x, a.x1, a.x2);
    const cz = clamp(entity.z, a.z1, a.z2);
    const dx = entity.x - cx, dz = entity.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    hit = true;
    const d = Math.sqrt(d2) || 0.001;
    const push = radius - d;
    if (d2 < 1e-6) {
      // Centre inside the box: push out along the smallest penetration axis.
      const pl = entity.x - a.x1, pr = a.x2 - entity.x;
      const pt = entity.z - a.z1, pb = a.z2 - entity.z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) entity.x = a.x1 - radius;
      else if (m === pr) entity.x = a.x2 + radius;
      else if (m === pt) entity.z = a.z1 - radius;
      else entity.z = a.z2 + radius;
    } else {
      entity.x += (dx / d) * push;
      entity.z += (dz / d) * push;
    }
  }
  return hit;
}

export function resolveCarCollision(car, buildings) {
  const hit = resolveCircleBuildings(car, 1.6, buildings);
  if (hit) {
    car.speed *= -0.35; // bounce back
    car.hit = true;
  }
  return hit;
}
