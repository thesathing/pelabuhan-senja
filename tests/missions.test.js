// PELABUHAN SENJA — part 3 mission + HUD + map + audio contracts (Node).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MISSIONS, TOTAL_REWARD, START_CASH, SAVE_KEY, DIFFICULTY,
  createGameState, startMission, updateMission, failMission, retryMission,
  nextMission, currentMission, currentStage, fireWeapon, reloadWeapon,
  switchWeapon, serializeGame, saveGame, loadGame, mapJobs, mapStats,
} from '../game/missions.js';
import { PENTATONIC, RADIO_PATTERN, sirenToneAt, engineFreq, createAudioEngine } from '../game/audio.js';
import { formatCash, wantedStars, policeStatus } from '../game/ui.js';
import { DISTRICTS, ROADS, heightAt, roadDistance } from '../game/world-data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

function mockStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, v); },
  };
}

// Drive a mission to completion by standing on each stage point.
function playMission(state, dt = 1) {
  let guard = 0;
  while (state.missionActive && guard < 200) {
    guard += 1;
    const stage = currentStage(state);
    assert.ok(stage, 'a stage is current while the mission is active');
    const events = updateMission(state, { x: stage.x, z: stage.z }, dt);
    if (events.some((e) => e.type === 'complete')) break;
  }
  assert.ok(guard < 200, 'mission completes without an endless stage');
}

describe('mission definitions', () => {
  it('has 5 missions, rewards $350 -> $1200, wanted 0/0/2/1/3', () => {
    assert.equal(MISSIONS.length, 5);
    assert.deepEqual(MISSIONS.map((m) => m.reward), [350, 500, 800, 1000, 1200]);
    assert.deepEqual(MISSIONS.map((m) => m.wanted), [0, 0, 2, 1, 3]);
    assert.equal(TOTAL_REWARD, 3850);
    assert.deepEqual(MISSIONS.map((m) => m.title), [
      'FIRST DELIVERY', 'MARKET PICKUP', 'HARBOR HEIST', 'RIVAL AMBUSH', 'THE LIGHTHOUSE RUN',
    ]);
  });

  it('every stage sits on reachable land (on a road, above the water plane)', () => {
    // The water plane covers x -10..220, z -90..140 at y 0.15; west of it the
    // ground is dry at any height. A stage inside the plane must sit above it.
    const inPlane = (x, z) => x >= -10 && x <= 220 && z >= -90 && z <= 140;
    for (const m of MISSIONS) {
      assert.ok(m.stages.length >= 2, `${m.id} has stages`);
      for (const s of m.stages) {
        if (inPlane(s.x, s.z)) {
          assert.ok(heightAt(s.x, s.z) > 0.15, `${m.id} stage above water (h=${heightAt(s.x, s.z).toFixed(1)})`);
        }
        assert.ok(roadDistance(s.x, s.z) < 8, `${m.id} stage near a road`);
      }
    }
  });

  it('all mission text and dialogue is ASCII English', () => {
    for (const m of MISSIONS) {
      for (const text of [m.objective, ...m.stages.map((s) => s.label)]) {
        assert.ok(/^[\x00-\x7F]*$/.test(text), `ASCII: ${text}`);
      }
      for (const d of Object.values(m.dialogue)) {
        assert.ok(d.speaker && d.text.length > 10, 'dialogue has a speaker and a line');
        assert.ok(/^[\x00-\x7F]*$/.test(d.text), `ASCII dialogue: ${d.text}`);
      }
    }
  });

  it('the heist has a hold stage and the market pickup counts 3 crates', () => {
    const heist = MISSIONS[2];
    assert.ok(heist.stages.some((s) => s.kind === 'hold' && s.holdSeconds === 5), 'hold-to-hotwire stage');
    const pickup = MISSIONS[1];
    assert.equal(pickup.stages.filter((s) => s.label.includes('Crate')).length, 3, '3 crates');
  });
});

describe('full 5-mission win path', () => {
  it('plays all five missions to completion: $4090 cash, respect 10, wanted 0', () => {
    const state = createGameState('NORMAL');
    assert.equal(state.cash, START_CASH);
    assert.equal(state.health, 100);
    for (let i = 0; i < 5; i += 1) {
      const mission = startMission(state, i);
      assert.equal(state.wanted, mission.wanted, `${mission.id} sets its wanted level`);
      playMission(state);
      assert.ok(state.completed.includes(mission.id), `${mission.id} done`);
    }
    assert.equal(state.completed.length, 5);
    assert.equal(state.allDone, true);
    assert.equal(state.cash, START_CASH + TOTAL_REWARD, '240 + 3850 = 4090');
    assert.equal(state.respect, 10, 'respect capped at 10');
    assert.equal(state.wanted, 0, 'heat off after the last job');
    assert.equal(currentMission(state), null, 'no current mission after all five');
  });

  it('the hold stage needs 5 seconds on the truck before it advances', () => {
    const state = createGameState('NORMAL');
    startMission(state, 2);
    // Stage 0: reach the truck.
    updateMission(state, { x: 55, z: 40 }, 1);
    assert.equal(state.stageIndex, 1, 'reached the truck');
    // Stage 1: hold — 3 s is not enough.
    updateMission(state, { x: 55, z: 40 }, 3);
    assert.equal(state.stageIndex, 1, 'still hot-wiring after 3 s');
    updateMission(state, { x: 55, z: 40 }, 2.5);
    assert.equal(state.stageIndex, 2, 'hot-wired after 5 s total');
    // Leaving the radius resets the hold timer.
    startMission(state, 2);
    updateMission(state, { x: 55, z: 40 }, 1);
    updateMission(state, { x: 55, z: 40 }, 3);
    updateMission(state, { x: 0, z: 0 }, 1);
    assert.equal(state.holdTime, 0, 'hold resets off-target');
  });

  it('failing a mission (BUSTED) keeps the cash, restores health, retries clean', () => {
    const state = createGameState('NORMAL');
    startMission(state, 2);
    state.cash = 900;
    state.health = 5;
    const failed = failMission(state, 'BUSTED');
    assert.equal(failed.type, 'failed');
    assert.equal(failed.reason, 'BUSTED');
    assert.equal(state.missionActive, false);
    assert.equal(state.missionFailed, true);
    assert.equal(state.cash, 900, 'no reward on a failed job');
    assert.equal(state.health, 100, 'health restored for the retry');
    assert.equal(state.wanted, 0, 'heat off after the bust');
    retryMission(state);
    assert.equal(state.missionActive, true);
    assert.equal(state.stageIndex, 0, 'restarted from stage 1');
    assert.equal(state.wanted, 2, 'heist heat back on');
  });

  it('nextMission advances to the next job and returns null after the last', () => {
    const state = createGameState('NORMAL');
    startMission(state, 0);
    playMission(state);
    const m2 = nextMission(state);
    assert.equal(m2.id, 'market-pickup');
    assert.equal(state.missionIndex, 1);
    startMission(state, 4);
    playMission(state);
    assert.equal(nextMission(state), null, 'nothing after the lighthouse run');
  });
});

describe('difficulty', () => {
  it('EASY is gentler and HARD is harsher than NORMAL', () => {
    assert.ok(DIFFICULTY.EASY.policeSpeed < DIFFICULTY.NORMAL.policeSpeed);
    assert.ok(DIFFICULTY.HARD.policeSpeed > DIFFICULTY.NORMAL.policeSpeed);
    assert.ok(DIFFICULTY.EASY.ramDamage < DIFFICULTY.HARD.ramDamage);
    assert.equal(createGameState('EASY').health, 120);
    assert.equal(createGameState('HARD').health, 80);
    assert.equal(createGameState('BOGUS').difficulty, 'NORMAL', 'unknown difficulty falls back');
  });
});

describe('weapons', () => {
  it('pistol fires 12/48, empties, reloads from reserve; SMG stays locked', () => {
    const state = createGameState('NORMAL');
    assert.equal(switchWeapon(state, 'PISTOL'), true);
    for (let i = 0; i < 12; i += 1) assert.equal(fireWeapon(state).fired, true);
    assert.equal(state.ammo, 0);
    assert.equal(fireWeapon(state).fired, false, 'dry fire on empty');
    assert.equal(reloadWeapon(state), true);
    assert.equal(state.ammo, 12);
    assert.equal(state.reserve, 36, '12 moved from reserve');
    assert.equal(switchWeapon(state, 'SMG'), false, 'SMG locked');
    assert.equal(switchWeapon(state, 'FISTS'), true);
    assert.equal(fireWeapon(state).fired, true, 'fists never run dry');
    assert.equal(reloadWeapon(state), false, 'no reload for fists');
  });
});

describe('save / load', () => {
  it('round-trips a mid-campaign save through a localStorage-like store', () => {
    const storage = mockStorage();
    const state = createGameState('HARD');
    startMission(state, 0);
    playMission(state);
    startMission(state, 1);
    assert.equal(saveGame(state, storage), true);
    assert.ok(storage.getItem(SAVE_KEY).includes('"v":1'), 'versioned save');
    const loaded = loadGame(storage);
    assert.equal(loaded.difficulty, 'HARD');
    assert.equal(loaded.cash, START_CASH + 350);
    assert.equal(loaded.missionIndex, 1);
    assert.deepEqual(loaded.completed, ['first-delivery']);
    assert.equal(loaded.allDone, false);
    const again = loadGame(storage);
    assert.equal(again.cash, loaded.cash, 'loads repeatably');
  });

  it('returns null for a missing or corrupt save', () => {
    const storage = mockStorage();
    assert.equal(loadGame(storage), null, 'no save yet');
    storage.setItem(SAVE_KEY, '{not json');
    assert.equal(loadGame(storage), null, 'corrupt save is ignored');
    storage.setItem(SAVE_KEY, JSON.stringify({ v: 99, completed: [] }));
    assert.equal(loadGame(storage), null, 'wrong version is ignored');
    assert.equal(serializeGame(createGameState()).includes('pelabuhan'), false, 'save holds data, not the title');
  });
});

describe('city map data', () => {
  it('has 6 districts and 5 jobs with cash + status', () => {
    assert.equal(DISTRICTS.length, 6);
    assert.deepEqual(DISTRICTS.map((d) => d.name), [
      'OLD TOWN', 'TANJUNG API', 'PASAR SENJA', 'DERMAGA', 'THE HARBOR', 'PERGUDANGAN',
    ]);
    const state = createGameState('NORMAL');
    const jobs = mapJobs(state);
    assert.equal(jobs.length, 5);
    assert.deepEqual(jobs.map((j) => j.cash), [350, 500, 800, 1000, 1200]);
    assert.equal(jobs[0].status, 'AVAILABLE', 'first job is open');
    assert.ok(jobs.slice(1).every((j) => j.status === 'LOCKED'), 'later jobs locked');
    assert.ok(jobs.every((j) => j.district && j.title), 'every job has a district and title');
    const stats = mapStats(state);
    assert.equal(stats.missionsDone, 0);
    assert.equal(stats.missionsTotal, 5);
    assert.equal(stats.totalReward, 3850);
    startMission(state, 0);
    playMission(state);
    const jobs2 = mapJobs(state);
    assert.equal(jobs2[0].status, 'DONE');
    assert.equal(mapStats(state).missionsDone, 1);
    nextMission(state);
    assert.equal(mapJobs(state)[1].status, 'ACTIVE', 'next job goes active after NEXT');
  });

  it('the map markers in ui.js match the missions final stages', () => {
    const ui = read('game/ui.js');
    for (const m of MISSIONS) {
      const last = m.stages[m.stages.length - 1];
      assert.ok(ui.includes(`'${m.id}': { x: ${last.x}, z: ${last.z} }`),
        `ui.js marker for ${m.id} matches its final stage`);
    }
  });
});

describe('HUD pure helpers', () => {
  it('formats cash, stars, and police statuses', () => {
    assert.equal(formatCash(4090), '$4,090');
    assert.equal(formatCash(240), '$240');
    assert.equal(wantedStars(0), '☆☆☆☆☆');
    assert.equal(wantedStars(2), '★★☆☆☆');
    assert.equal(wantedStars(3), '★★★☆☆');
    const player = { x: 0, z: 0, heading: 0 }; // facing +z
    assert.equal(policeStatus({ x: 50, z: 50, contact: false }, player, 0), 'PATROL', 'no heat, no chase');
    assert.equal(policeStatus({ x: 5, z: 5, contact: true }, player, 2), 'RAMMING', 'contact rams');
    assert.equal(policeStatus({ x: 0, z: 20, contact: false }, player, 2), 'ROADBLOCK', 'unit ahead blocks the road');
    assert.equal(policeStatus({ x: 0, z: -20, contact: false }, player, 2), 'PURSUIT', 'unit behind pursues');
  });
});

describe('procedural audio (Node-safe)', () => {
  it('is an A-minor pentatonic radio: A C D E G A', () => {
    const semis = PENTATONIC.map((f) => Math.round(12 * Math.log2(f / 440)));
    assert.deepEqual(semis, [0, 3, 5, 7, 10, 12]);
    assert.ok(RADIO_PATTERN.every((i) => i >= 0 && i < PENTATONIC.length), 'pattern indexes are in range');
  });

  it('alternates the siren 750/1000 Hz every 0.4 s and scales engine hum with speed', () => {
    assert.equal(sirenToneAt(0), 750);
    assert.equal(sirenToneAt(0.39), 750);
    assert.equal(sirenToneAt(0.4), 1000);
    assert.equal(sirenToneAt(0.8), 750);
    assert.equal(engineFreq(0), 40);
    assert.ok(Math.abs(engineFreq(23) - 120.5) < 0.01, '120.5 Hz at top speed');
    assert.ok(engineFreq(11.5) > engineFreq(0) && engineFreq(11.5) < engineFreq(23), 'hum rises with speed');
  });

  it('returns a no-op stub in Node (no AudioContext) that never throws', () => {
    const engine = createAudioEngine();
    assert.equal(engine.available, false);
    assert.doesNotThrow(() => {
      engine.unlock();
      engine.setSpeed(20);
      engine.setWanted(3);
      engine.setScreech(true);
      engine.setDriving(true);
      engine.update(1.5);
      engine.shot();
      engine.impact();
      engine.pickup();
      engine.blip();
    });
  });
});

describe('main.js wiring (part 3)', () => {
  it('imports missions, ui and audio; gates play behind the title; exposes staging handles', () => {
    const main = read('game/main.js');
    assert.ok(main.includes("from './missions.js'"), 'imports missions');
    assert.ok(main.includes("from './ui.js'"), 'imports ui');
    assert.ok(main.includes("from './audio.js'"), 'imports audio');
    assert.ok(main.includes("phase === 'playing'"), 'simulation gated on the playing phase');
    assert.ok(main.includes('createHUD'), 'builds the HUD');
    assert.ok(main.includes('showTitle'), 'shows the title screen on load');
    assert.ok(main.includes('beaconGroup'), 'objective beacon exists');
    assert.ok(main.includes('startGame(diff)'), 'debug start handle');
    assert.ok(main.includes('teleport(x, z)'), 'debug teleport handle');
    assert.ok(main.includes('setMission(i)'), 'debug mission-select handle');
    assert.ok(main.includes('setWanted(n)'), 'debug wanted handle');
    assert.ok(main.includes("localStorage"), 'save uses localStorage');
    assert.ok(!/https?:\/\//.test(main), 'main.js has no network URL');
  });

  it('has no referral code in the new part-3 files', () => {
    for (const p of ['game/missions.js', 'game/ui.js', 'game/audio.js', 'game/main.js']) {
      assert.ok(!/referral|utm_source|wftbn3z4/i.test(read(p)), `${p} is referral-free`);
    }
  });
});
