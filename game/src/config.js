// PELABUHAN SENJA — tunable constants for the whole game.
//
// One place for every number a later pass might want to tune: the city's
// size, the car's feel, the chase camera, and the dusk palette. Nothing here
// is read from the network or the clock; the world is seeded, so the same
// constants always build the same city.

export const WORLD = {
  // City slab half-extent in metres (the drivable city is -150..150).
  halfSize: 150,
  // Roads run on this grid: lines at -120, -80, ..., 120.
  roadSpacing: 40,
  roadFirst: -120,
  roadLast: 120,
  roadWidth: 10,
  // The sea starts here; the beach is the strip between the slab and the sea.
  beachStart: 150,
  seaStart: 176,
  // Deterministic seed: the same seed rebuilds the same streets.
  seed: 20261121,
};

export const CAR = {
  // Arcade driving feel (metres, seconds).
  accel: 17,
  reverseAccel: 10,
  brake: 34,
  drag: 0.55,
  rollingDrag: 1.6,
  maxSpeed: 38,
  maxReverse: 10,
  wheelBase: 2.9,
  maxSteer: 0.55,
  // Collision circle around the car, in metres.
  radius: 1.7,
};

export const CAMERA = {
  // Low chase: close to the road, just above the roofline.
  chaseHeight: 4.5,
  chaseDistance: 11,
  lookAhead: 7,
  lookHeight: 1.4,
  followStiffness: 5.5,
  baseFov: 62,
  maxFov: 78,
  fovKickSpeed: 30,
};

export const DUSK = {
  skyTop: '#4a2b6e',
  skyMid: '#b34a6e',
  skyHorizon: '#ff9a4d',
  sunColor: '#ffb36b',
  sunIntensity: 2.4,
  hemiSky: '#8a7bd8',
  hemiGround: '#3a2f28',
  hemiIntensity: 0.95,
  fogColor: '#3a2450',
  fogNear: 190,
  fogFar: 720,
};

export const PLAYER = {
  startX: 0,
  startZ: 60,
  // Heading 0 faces -Z (north, into the city).
  startHeading: 0,
  color: 0xff6a1f,
};
