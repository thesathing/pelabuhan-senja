// PELABUHAN SENJA — the chase camera.
//
// A low chase camera that sits just above the roofline, a short distance
// behind the player car, and follows with a soft spring so the road feels
// fast without whipping around. The field of view opens up as the car
// gathers speed (the "FOV kick"), and a mouse drag lets the player peek
// around the car. Fixed shot presets (for screenshots) park the camera at a
// chosen spot instead of chasing.

import * as THREE from '../vendor/three.module.min.js';
import { CAMERA } from './config.js';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3();
    this.current = new THREE.Vector3(0, CAMERA.chaseHeight, CAMERA.chaseDistance);
    this.lookPoint = new THREE.Vector3();
    this.orbitYaw = 0;
    this.orbitPitch = 0;
    this.fixed = null;
    this.chaseDistance = CAMERA.chaseDistance;
    this.chaseHeight = CAMERA.chaseHeight;
    this.snapped = false;
    this.fov = CAMERA.baseFov;
    camera.fov = CAMERA.baseFov;
    camera.updateProjectionMatrix();
  }

  // Park the camera for a screenshot: `at` is the eye, `look` the target.
  setFixed(at, look) {
    this.fixed = { at: new THREE.Vector3(...at), look: new THREE.Vector3(...look) };
  }

  // A shot may ask for a wider or higher chase than the default.
  setChase(distance, height) {
    this.chaseDistance = distance;
    this.chaseHeight = height;
  }

  clearFixed() {
    this.fixed = null;
  }

  // Mouse drag nudges the orbit offset, in radians, clamped so the camera
  // never flips under the road.
  addOrbit(dx, dy) {
    this.orbitYaw = Math.max(-0.9, Math.min(0.9, this.orbitYaw + dx * 0.003));
    this.orbitPitch = Math.max(-0.25, Math.min(0.45, this.orbitPitch + dy * 0.002));
  }

  update(dt, carPos, heading, speed) {
    if (this.fixed) {
      this.camera.position.copy(this.fixed.at);
      this.camera.lookAt(this.fixed.look);
      return;
    }
    // Forward is (-sin h, 0, -cos h); behind the car is the opposite.
    const behindX = Math.sin(heading);
    const behindZ = Math.cos(heading);
    const yaw = this.orbitYaw;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const offX = behindX * cosY - behindZ * sinY;
    const offZ = behindX * sinY + behindZ * cosY;
    const dist = this.chaseDistance;
    const height = this.chaseHeight + this.orbitPitch * 6;
    this.target.set(carPos.x + offX * dist, height, carPos.z + offZ * dist);

    // The first frame snaps straight onto the car: the camera never starts
    // at the world origin and swoops in, at any frame rate.
    if (!this.snapped) {
      this.current.copy(this.target);
      this.snapped = true;
    }
    // Exponential smoothing: fast enough to feel attached, slow enough to
    // glide over bumps in the steering.
    const k = 1 - Math.exp(-CAMERA.followStiffness * dt);
    this.current.lerp(this.target, k);
    this.camera.position.copy(this.current);

    this.lookPoint.set(
      carPos.x - Math.sin(heading) * CAMERA.lookAhead,
      CAMERA.lookHeight,
      carPos.z - Math.cos(heading) * CAMERA.lookAhead
    );
    this.camera.lookAt(this.lookPoint);

    // Speed FOV kick: the world widens as the car runs.
    const wantFov = CAMERA.baseFov + Math.min(1, Math.abs(speed) / CAMERA.fovKickSpeed) * (CAMERA.maxFov - CAMERA.baseFov);
    this.fov += (wantFov - this.fov) * (1 - Math.exp(-3 * dt));
    if (Math.abs(this.fov - this.camera.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
