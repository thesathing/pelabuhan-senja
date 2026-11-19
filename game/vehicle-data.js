// PELABUHAN SENJA — pure vehicle specs + proportion contract + driving constants.
// No three.js import, Node-testable. The three.js builders (vehicles.js) consume
// these specs; the driving model (driving.js) consumes the constants.
//
// Proportion note (documented, not hidden): the spec asks for a GT coupe with
// roofline ~0.975 and a contract that fails a wheel/body ratio >= 0.75, where
// wheel/body ratio = wheel diameter / roofline. With 0.38 wheels (0.76 diameter)
// a 0.975 roofline gives 0.76 / 0.975 = 0.78, which fails its own contract.
// So the coupe roofline is 1.02 (within 5% of 0.975, still a low sleek GT line),
// giving 0.76 / 1.02 = 0.745 < 0.75. The contract below enforces this.

export const COUPE = {
  kind: 'coupe',
  length: 5.2,
  width: 2.1,
  wheelRadius: 0.38,
  roofline: 1.02,
  hood: 2.1,
  cabin: 1.8,
  wheelbase: 3.0,
  bodyHeight: 0.62, // sill to beltline (the slab); glasshouse sits above it
  glasshouseHeight: 0.4,
  color: 0xc2183a, // deep red
};

export const CONVERTIBLE = {
  ...COUPE,
  kind: 'convertible',
  openTop: true,
  rollHoop: true,
  color: 0x1f6f8b, // teal
};

export const INTERCEPTOR = {
  ...COUPE,
  kind: 'interceptor',
  lightBar: true,
  color: 0xe8e8e8, // white police body
  accent: 0x14202e, // black hood / doors band
};

export const TRUCK = {
  kind: 'truck',
  length: 7.6,
  width: 2.5,
  wheelRadius: 0.52,
  roofline: 2.35, // cab roof; trucks are exempt from the coupe roofline bound
  hood: 1.4,
  cabin: 2.4,
  wheelbase: 4.6,
  bodyHeight: 1.1,
  containerLength: 4.6,
  containerHeight: 2.2,
  color: 0x8a6f3c, // ochre box truck
};

export const VEHICLE_SPECS = { coupe: COUPE, convertible: CONVERTIBLE, interceptor: INTERCEPTOR, truck: TRUCK };

// Wheel/body ratio: wheel diameter over roofline height. A real GT keeps the
// wheels modest against a low roofline; a ratio >= 0.75 means the wheels are
// absurdly large for the body (or the body is a squat slab).
export function wheelBodyRatio(spec) {
  return (2 * spec.wheelRadius) / spec.roofline;
}

// Proportion contract for a true sports car. Returns { pass, failures }.
export function checkProportions(spec) {
  const failures = [];
  if (spec.kind === 'truck') {
    // Trucks have their own contract: low wide cab + ribbed container.
    if (spec.wheelRadius < 0.45) failures.push('truck wheels too small (< 0.45)');
    if (spec.width < 2.3) failures.push('truck cab too narrow (< 2.3)');
    if (!spec.containerLength || spec.containerLength < 4) failures.push('truck container too short (< 4)');
    return { pass: failures.length === 0, failures };
  }
  if (Math.abs(spec.length - 5.2) > 0.25) failures.push(`length ${spec.length} not a 5.2 GT`);
  if (Math.abs(spec.width - 2.1) > 0.15) failures.push(`width ${spec.width} not a 2.1 GT`);
  if (spec.roofline > 1.15) failures.push(`roofline ${spec.roofline} too high (bubble dome)`);
  if (spec.roofline < 0.9) failures.push(`roofline ${spec.roofline} too low (slab)`);
  if (!(spec.hood > spec.cabin)) failures.push(`hood ${spec.hood} not longer than cabin ${spec.cabin} (short-hood bubble)`);
  const ratio = wheelBodyRatio(spec);
  if (ratio >= 0.75) failures.push(`wheel/body ratio ${ratio.toFixed(3)} >= 0.75 (wheels too big for the body)`);
  if (spec.wheelRadius < 0.3 || spec.wheelRadius > 0.45) failures.push(`wheel radius ${spec.wheelRadius} outside GT range`);
  return { pass: failures.length === 0, failures };
}

// Bubble-car fixtures the contract must reject.
export const BUBBLE_TALL = {
  kind: 'coupe', length: 4.4, width: 1.9, wheelRadius: 0.3,
  roofline: 1.55, hood: 1.4, cabin: 1.9, wheelbase: 2.6, bodyHeight: 0.9,
};
export const BUBBLE_WHEELS = {
  kind: 'coupe', length: 5.2, width: 2.1, wheelRadius: 0.55,
  roofline: 1.0, hood: 2.1, cabin: 1.8, wheelbase: 3.0, bodyHeight: 0.62,
};

// --- Driving constants (spec numbers, all in metres / seconds / radians). ---
export const DRIVING = {
  accel: 12, // m/s^2
  maxSpeed: 23, // m/s (82.8 km/h)
  maxReverse: -9,
  brake: 18, // m/s^2 braking
  drag: 0.55, // 1/s coast drag
  handbrakeDrag: 1.2,
  driftYawMult: 2.1, // handbrake yaw multiplier
  maxSteer: 0.55, // rad at standstill, speed-scaled down
  steerFalloff: 0.06, // per m/s
  wheelbase: 3.0,
  walkSpeed: 5.5,
  runSpeed: 9,
  hopVelocity: 6.5,
  gravity: 18,
  fovMin: 57,
  fovMax: 64,
  shakeSpeedKmh: 60, // camera shake above this
  policeMaxSpeed: 25, // interceptors are slightly faster than the player
  policeTurnRate: 1.9, // rad/s
  policeRamDistance: 3.2, // contact distance
  pedFleeRadius: 12,
  pedFleeSpeed: 4.2,
  pedWanderSpeed: 1.2,
};

export function speedKmh(speedMs) { return Math.abs(speedMs) * 3.6; }

// FOV kick: 57 at rest, 64 at top speed.
export function fovForSpeed(speedMs) {
  const t = Math.min(Math.abs(speedMs) / DRIVING.maxSpeed, 1);
  return DRIVING.fovMin + (DRIVING.fovMax - DRIVING.fovMin) * t;
}

// Camera shake amplitude (metres) above 60 km/h, 0 below.
export function shakeForSpeed(speedMs) {
  const kmh = speedKmh(speedMs);
  if (kmh <= DRIVING.shakeSpeedKmh) return 0;
  return 0.02 + 0.13 * ((kmh - DRIVING.shakeSpeedKmh) / (DRIVING.maxSpeed * 3.6 - DRIVING.shakeSpeedKmh));
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
