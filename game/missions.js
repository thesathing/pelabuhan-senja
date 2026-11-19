// PELABUHAN SENJA — pure mission logic (no three.js, no DOM, Node-testable).
// Five missions with real stage logic, cash, wanted levels, dialogue, and a
// localStorage save. The three.js layer (main.js) feeds the player position
// in each frame and reacts to the events updateMission returns.
//
// Objective points sit on road centrelines (buildings are never centred on a
// road), so every stage is reachable on foot or in the car.

export const SAVE_KEY = 'pelabuhan-senja-save-v1';
export const START_CASH = 240;

export const DIFFICULTY = {
  EASY: { label: 'EASY', policeSpeed: 0.8, ramDamage: 0.6, health: 120 },
  NORMAL: { label: 'NORMAL', policeSpeed: 1.0, ramDamage: 1.0, health: 100 },
  HARD: { label: 'HARD', policeSpeed: 1.2, ramDamage: 1.5, health: 80 },
};

// All in-game text is English; proper names are Pelabuhan Senja places/people.
export const MISSIONS = [
  {
    id: 'first-delivery',
    chapter: 'CH 1',
    title: 'FIRST DELIVERY',
    objective: 'Deliver the parcel to the Pasar Senja night market.',
    reward: 350,
    wanted: 0,
    stages: [
      { kind: 'goto', label: 'Pick up the parcel at Pasar Senja', x: -80, z: 0, r: 5 },
      { kind: 'goto', label: 'Deliver the parcel to the harbor truck', x: 100, z: 40, r: 5 },
    ],
    dialogue: {
      start: { speaker: 'Mira', text: 'Raka, one parcel, one run. Pick it up at Pasar Senja and take it to the harbor. No detours.' },
      complete: { speaker: 'Mira', text: 'Clean run. The crew notices that kind of thing.' },
    },
  },
  {
    id: 'market-pickup',
    chapter: 'CH 2',
    title: 'MARKET PICKUP',
    objective: 'Collect 3 crates from the market stalls and bring them to the docks.',
    reward: 500,
    wanted: 0,
    stages: [
      { kind: 'goto', label: 'Crate 1 of 3 - north stall', x: -100, z: 20, r: 5 },
      { kind: 'goto', label: 'Crate 2 of 3 - middle stall', x: -50, z: -20, r: 5 },
      { kind: 'goto', label: 'Crate 3 of 3 - south stall', x: 0, z: 30, r: 5 },
      { kind: 'goto', label: 'Deliver the crates to the docks', x: 50, z: 90, r: 5 },
    ],
    dialogue: {
      start: { speaker: 'Mira', text: 'Three crates at the market. Grab them all and bring them to the docks. Careful with the third one.' },
      stage: { speaker: 'Dimas', text: 'Two down. The last crate is by the south stall.' },
      complete: { speaker: 'Mira', text: 'All three. You are earning your cut.' },
    },
  },
  {
    id: 'harbor-heist',
    chapter: 'CH 3',
    title: 'HARBOR HEIST',
    objective: 'Steal the boat-side truck and escape the two-star heat.',
    reward: 800,
    wanted: 2,
    stages: [
      { kind: 'goto', label: 'Reach the boat-side truck', x: 55, z: 40, r: 6 },
      { kind: 'hold', label: 'Hot-wire the truck - stay close', x: 55, z: 40, r: 6, holdSeconds: 5 },
      { kind: 'goto', label: 'Escape to the Old Town', x: -120, z: 0, r: 6 },
    ],
    dialogue: {
      start: { speaker: 'Dimas', text: 'The boat-side truck is loaded. Take it while the harbor is quiet - and do not stop for anyone.' },
      complete: { speaker: 'Dimas', text: 'Ha! They will be talking about this one for weeks.' },
    },
  },
  {
    id: 'rival-ambush',
    chapter: 'CH 4',
    title: 'RIVAL AMBUSH',
    objective: 'Run three checkpoints through Pergudangan while the rivals wait.',
    reward: 1000,
    wanted: 1,
    stages: [
      { kind: 'goto', label: 'Checkpoint 1 of 3 - south gate', x: 50, z: 80, r: 5 },
      { kind: 'goto', label: 'Checkpoint 2 of 3 - warehouse row', x: 0, z: 110, r: 5 },
      { kind: 'goto', label: 'Checkpoint 3 of 3 - north gate', x: -50, z: 120, r: 5 },
    ],
    dialogue: {
      start: { speaker: 'Dimas', text: 'Rivals are waiting in Pergudangan. Three checkpoints, no slowing down. Show them whose streets these are.' },
      complete: { speaker: 'Mira', text: 'They backed off. The streets remember.' },
    },
  },
  {
    id: 'lighthouse-run',
    chapter: 'CH 5',
    title: 'THE LIGHTHOUSE RUN',
    objective: 'Reach the lamp at Tanjung Api with three stars on your tail.',
    reward: 1200,
    wanted: 3,
    stages: [
      { kind: 'goto', label: 'Take the hill road up', x: 78, z: -62, r: 6 },
      { kind: 'goto', label: 'Reach the lamp at Tanjung Api', x: 105, z: -95, r: 7 },
    ],
    dialogue: {
      start: { speaker: 'Mira', text: 'Last one, Raka. The lighthouse at Tanjung Api. Every cop in the city will be on you - so be faster.' },
      complete: { speaker: 'Mira', text: 'Tanjung Api keeps the last light. Lorong Senja is home.' },
    },
  },
];

export const TOTAL_REWARD = MISSIONS.reduce((sum, m) => sum + m.reward, 0);

// --- Game state -----------------------------------------------------------

export function createGameState(difficulty = 'NORMAL') {
  const key = DIFFICULTY[difficulty] ? difficulty : 'NORMAL';
  const diff = DIFFICULTY[key];
  return {
    difficulty: key,
    cash: START_CASH,
    respect: 1,
    health: diff.health,
    maxHealth: diff.health,
    wanted: 0,
    missionIndex: 0,
    completed: [],
    stageIndex: 0,
    holdTime: 0,
    missionActive: false,
    missionFailed: false,
    allDone: false,
    weapon: 'FISTS',
    ammo: 12,
    reserve: 48,
    smgLocked: true,
  };
}

export function currentMission(state) {
  if (state.allDone) return null;
  return state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
}

export function startMission(state, index = state.missionIndex) {
  const mission = MISSIONS[index];
  if (!mission) return null;
  state.missionIndex = index;
  state.stageIndex = 0;
  state.holdTime = 0;
  state.missionActive = true;
  state.missionFailed = false;
  state.wanted = mission.wanted;
  return mission;
}

export function currentStage(state) {
  const mission = currentMission(state);
  if (!mission || !state.missionActive) return null;
  return mission.stages[state.stageIndex] ?? null;
}

// Advance the mission from the player position. Returns an array of events:
// { type: 'stage', stage } | { type: 'complete', mission } | { type: 'failed' }.
export function updateMission(state, playerPos, dt) {
  const events = [];
  const mission = currentMission(state);
  if (!mission || !state.missionActive || state.missionFailed) return events;
  const stage = mission.stages[state.stageIndex];
  if (!stage) return events;
  const d = Math.hypot(playerPos.x - stage.x, playerPos.z - stage.z);
  if (d > stage.r) {
    state.holdTime = 0;
    return events;
  }
  if (stage.kind === 'hold') {
    state.holdTime += dt;
    if (state.holdTime < stage.holdSeconds) return events;
  }
  state.holdTime = 0;
  state.stageIndex += 1;
  if (state.stageIndex < mission.stages.length) {
    events.push({ type: 'stage', mission, stage: mission.stages[state.stageIndex], stageIndex: state.stageIndex });
  } else {
    state.missionActive = false;
    state.completed.push(mission.id);
    state.cash += mission.reward;
    state.respect = Math.min(10, state.respect + 2);
    state.wanted = 0;
    if (state.completed.length >= MISSIONS.length) state.allDone = true;
    events.push({ type: 'complete', mission });
  }
  return events;
}

export function failMission(state, reason = 'BUSTED') {
  const mission = currentMission(state);
  if (!mission || !state.missionActive) return null;
  state.missionActive = false;
  state.missionFailed = true;
  state.wanted = 0;
  state.health = state.maxHealth;
  return { type: 'failed', mission, reason };
}

export function retryMission(state) {
  state.missionFailed = false;
  return startMission(state, state.missionIndex);
}

export function nextMission(state) {
  if (state.missionIndex + 1 >= MISSIONS.length) return null;
  return startMission(state, state.missionIndex + 1);
}

// --- Weapons (HUD slots: FISTS / 12-48 / SMG LOCKED) ---------------------

export function fireWeapon(state) {
  if (state.weapon === 'PISTOL') {
    if (state.ammo <= 0) return { fired: false, empty: true };
    state.ammo -= 1;
    return { fired: true, empty: false };
  }
  return { fired: true, empty: false }; // FISTS: melee swing, no ammo
}

export function reloadWeapon(state) {
  if (state.weapon !== 'PISTOL') return false;
  const need = 12 - state.ammo;
  if (need <= 0 || state.reserve <= 0) return false;
  const moved = Math.min(need, state.reserve);
  state.ammo += moved;
  state.reserve -= moved;
  return true;
}

export function switchWeapon(state, weapon) {
  if (weapon === 'SMG' && state.smgLocked) return false;
  if (weapon !== 'FISTS' && weapon !== 'PISTOL' && weapon !== 'SMG') return false;
  state.weapon = weapon;
  return true;
}

// --- Save / load (localStorage-compatible storage) ------------------------

export function serializeGame(state) {
  return JSON.stringify({
    v: 1,
    difficulty: state.difficulty,
    cash: state.cash,
    respect: state.respect,
    missionIndex: state.missionIndex,
    completed: state.completed,
    weapon: state.weapon,
    ammo: state.ammo,
    reserve: state.reserve,
  });
}

export function saveGame(state, storage) {
  try {
    storage.setItem(SAVE_KEY, serializeGame(state));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.v !== 1 || !Array.isArray(data.completed)) return null;
    const state = createGameState(data.difficulty || 'NORMAL');
    state.cash = data.cash ?? START_CASH;
    state.respect = data.respect ?? 1;
    state.missionIndex = data.missionIndex ?? 0;
    state.completed = data.completed;
    state.weapon = data.weapon ?? 'FISTS';
    state.ammo = data.ammo ?? 12;
    state.reserve = data.reserve ?? 48;
    state.allDone = state.completed.length >= MISSIONS.length;
    return state;
  } catch (err) {
    return null;
  }
}

// --- City map data (real world data: 6 districts, 5 jobs) -----------------

export function mapJobs(state) {
  return MISSIONS.map((m, i) => ({
    id: m.id,
    chapter: m.chapter,
    title: m.title,
    cash: m.reward,
    district: missionDistrict(m),
    status: state.completed.includes(m.id)
      ? 'DONE'
      : i === state.missionIndex && state.missionActive
        ? 'ACTIVE'
        : i < state.missionIndex
          ? 'DONE'
          : i === state.missionIndex
            ? 'AVAILABLE'
            : 'LOCKED',
  }));
}

function missionDistrict(mission) {
  const stage = mission.stages[mission.stages.length - 1];
  // District of the mission's final stage, by the same rects as world-data.
  if (stage.x < -30 && stage.z < -30) return 'OLD TOWN';
  if (stage.x >= -30 && stage.z < -30) return 'TANJUNG API';
  if (stage.x < -30 && stage.z < 60) return 'PASAR SENJA';
  if (stage.x >= 60) return 'THE HARBOR';
  if (stage.z >= 60) return 'PERGUDANGAN';
  return 'DERMAGA';
}

export function mapStats(state) {
  return {
    cash: state.cash,
    respect: state.respect,
    missionsDone: state.completed.length,
    missionsTotal: MISSIONS.length,
    wanted: state.wanted,
    totalReward: TOTAL_REWARD,
  };
}
