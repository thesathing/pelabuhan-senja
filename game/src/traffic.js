// PELABUHAN SENJA — traffic.
//
// A living city's worth of cars on top of part A's loops: three cars per
// loop (fifteen alive at once), each with its own cruise speed, so the
// avenues never look empty. Cars slow for the car ahead, sometimes pause
// at an intersection as if letting someone cross, and any car that ends up
// far from the player is moved back onto a loop near the player, so the
// traffic stays where the action is instead of thinning out at the edges.

import { makeTrafficCar, updateTrafficCar } from './vehicles.js';

const CARS_PER_LOOP = 3;
const RESPAWN_DISTANCE = 200;

export class TrafficSystem {
  constructor(scene, loops) {
    this.scene = scene;
    this.loops = loops;
    this.cars = [];
    loops.forEach((loop, li) => {
      for (let k = 0; k < CARS_PER_LOOP; k++) {
        const car = makeTrafficCar(li * CARS_PER_LOOP + k, loop);
        // Spread the cars along the loop instead of stacking them at the
        // start: each one begins partway down its first segment.
        const segStart = loop[(car.target - 1 + loop.length) % loop.length];
        const segEnd = loop[car.target];
        const f = (k + 0.5) / CARS_PER_LOOP;
        car.mesh.position.set(
          segStart.x + (segEnd.x - segStart.x) * f,
          0,
          segStart.z + (segEnd.z - segStart.z) * f
        );
        car.cruiseSpeed = 5 + ((li * 7 + k * 3) % 9) * 0.5;
        car.speed = car.cruiseSpeed;
        car.loopIndex = li;
        car.pauseTimer = 0;
        car.nextPause = 5 + ((li + k * 2) % 8);
        car.hitCooldown = 0;
        scene.add(car.mesh);
        this.cars.push(car);
      }
    });
  }

  get aliveCount() {
    return this.cars.length;
  }

  // The car ahead of `car` on the same loop, if one is close in front.
  carAhead(car) {
    let best = null;
    let bestDist = 10;
    const fx = -Math.sin(car.heading);
    const fz = -Math.cos(car.heading);
    for (const other of this.cars) {
      if (other === car || other.loopIndex !== car.loopIndex) continue;
      const dx = other.mesh.position.x - car.mesh.position.x;
      const dz = other.mesh.position.z - car.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= bestDist) continue;
      // Only counts when it is actually in front of us, not behind.
      if (dist > 0.01 && (dx / dist) * fx + (dz / dist) * fz < 0.5) continue;
      best = other;
      bestDist = dist;
    }
    return best ? { car: best, dist: bestDist } : null;
  }

  update(dt, playerPos) {
    for (const car of this.cars) {
      if (car.hitCooldown > 0) car.hitCooldown -= dt;

      // Far from the player: move back onto a loop point near the player
      // instead of driving empty streets at the edge of the map.
      const dxp = car.mesh.position.x - playerPos.x;
      const dzp = car.mesh.position.z - playerPos.z;
      if (dxp * dxp + dzp * dzp > RESPAWN_DISTANCE * RESPAWN_DISTANCE) {
        const loop = car.loop;
        let bestPoint = loop[0];
        let bestScore = Infinity;
        for (const point of loop) {
          const d = Math.hypot(point.x - playerPos.x, point.z - playerPos.z);
          // Prefer a waypoint a little way off, not on top of the player.
          const score = Math.abs(d - 70);
          if (score < bestScore) {
            bestScore = score;
            bestPoint = point;
          }
        }
        car.mesh.position.set(bestPoint.x, 0, bestPoint.z);
        car.target = (loop.indexOf(bestPoint) + 1) % loop.length;
        car.speed = car.cruiseSpeed;
        car.pauseTimer = 0;
        continue;
      }

      // Occasional pause at an intersection, as if waiting for a gap.
      car.nextPause -= dt;
      if (car.nextPause <= 0) {
        car.pauseTimer = 1 + Math.random() * 2;
        car.nextPause = 6 + Math.random() * 10;
      }

      let want = car.cruiseSpeed;
      if (car.pauseTimer > 0) {
        car.pauseTimer -= dt;
        want = 0;
      } else {
        const ahead = this.carAhead(car);
        if (ahead) {
          // Ease up behind the car ahead; stop if we are right on it.
          want = ahead.dist < 5.5 ? 0 : Math.min(want, ahead.car.speed * 0.85);
        }
      }
      const k = 1 - Math.exp(-3 * dt);
      car.speed += (want - car.speed) * k;
      updateTrafficCar(car, dt);
    }
  }
}
