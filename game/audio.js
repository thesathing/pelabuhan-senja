// PELABUHAN SENJA — procedural WebAudio (no assets, no network).
// The AudioContext is created ONLY after a user gesture (unlock()).
// In Node (no window / AudioContext) createAudioEngine() returns a no-op
// stub, so the game logic and tests never touch the audio hardware.

// A-minor pentatonic, one octave up from A4 (440 Hz): A C D E G A.
export const PENTATONIC = [440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
export const RADIO_PATTERN = [0, 2, 4, 5, 4, 2, 1, 2]; // indexes into PENTATONIC
export const RADIO_STEP_SECONDS = 0.28;

// Engine hum: 40 Hz at rest rising with speed.
export function engineFreq(speedMs) {
  return 40 + Math.max(0, speedMs) * 3.5;
}

// Two-tone police siren: 750 Hz and 1000 Hz alternating every 0.4 s.
export function sirenToneAt(timeSeconds) {
  return Math.floor(timeSeconds / 0.4) % 2 === 0 ? 750 : 1000;
}

function makeStub() {
  const noop = () => {};
  return {
    available: false,
    unlock: noop,
    setSpeed: noop,
    setWanted: noop,
    setScreech: noop,
    setDriving: noop,
    shot: noop,
    impact: noop,
    pickup: noop,
    blip: noop,
    update: noop,
  };
}

export function createAudioEngine() {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
    return makeStub();
  }
  let ctx = null;
  let master = null;
  let droneOsc = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let screechSrc = null;
  let screechGain = null;
  let radioTimer = null;
  let radioStep = 0;
  let unlocked = false;
  let speed = 0;
  let wanted = 0;
  let screeching = false;
  let driving = false;

  function noiseBuffer(seconds = 1) {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function tone(freq, dur, type = 'sine', gain = 0.2, when = 0) {
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function startRadio() {
    if (radioTimer !== null) return;
    radioTimer = window.setInterval(() => {
      if (!driving || speed < 2) return;
      const note = PENTATONIC[RADIO_PATTERN[radioStep % RADIO_PATTERN.length]];
      radioStep += 1;
      tone(note, 0.26, 'triangle', 0.045);
    }, RADIO_STEP_SECONDS * 1000);
  }

  function applySiren(timeSeconds) {
    if (!sirenOsc) return;
    sirenOsc.frequency.setTargetAtTime(sirenToneAt(timeSeconds), ctx.currentTime, 0.05);
    sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.05 : 0, ctx.currentTime, 0.1);
  }

  return {
    available: true,
    unlock() {
      if (unlocked) return;
      unlocked = true;
      ctx = new window.AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      // Ambient triangle drone (55 Hz + 82.5 Hz fifth).
      droneOsc = ctx.createOscillator();
      droneOsc.type = 'triangle';
      droneOsc.frequency.value = 55;
      const droneGain = ctx.createGain();
      droneGain.gain.value = 0.04;
      const drone2 = ctx.createOscillator();
      drone2.type = 'triangle';
      drone2.frequency.value = 82.5;
      const drone2Gain = ctx.createGain();
      drone2Gain.gain.value = 0.025;
      droneOsc.connect(droneGain); droneGain.connect(master);
      drone2.connect(drone2Gain); drone2Gain.connect(master);
      droneOsc.start(); drone2.start();
      // Engine hum: sawtooth through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = engineFreq(0);
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      // Two-tone siren (silent until wanted > 0).
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 750;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      // Tire screech: looped noise through a bandpass.
      screechSrc = ctx.createBufferSource();
      screechSrc.buffer = noiseBuffer(2);
      screechSrc.loop = true;
      const screechFilter = ctx.createBiquadFilter();
      screechFilter.type = 'bandpass';
      screechFilter.frequency.value = 900;
      screechFilter.Q.value = 2.5;
      screechGain = ctx.createGain();
      screechGain.gain.value = 0;
      screechSrc.connect(screechFilter); screechFilter.connect(screechGain); screechGain.connect(master);
      screechSrc.start();
      startRadio();
    },
    setSpeed(v) {
      speed = v;
      if (!ctx || !engineOsc) return;
      engineOsc.frequency.setTargetAtTime(engineFreq(v), ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(driving ? Math.min(0.09, 0.02 + Math.abs(v) * 0.003) : 0, ctx.currentTime, 0.1);
    },
    setWanted(n) {
      wanted = n;
      if (ctx) applySiren(ctx.currentTime);
    },
    // Per-frame tick: advances the two-tone siren alternation.
    update(timeSeconds) {
      if (ctx) applySiren(timeSeconds);
    },
    setScreech(on) {
      screeching = on;
      if (!ctx || !screechGain) return;
      screechGain.gain.setTargetAtTime(on ? 0.12 : 0, ctx.currentTime, 0.05);
    },
    setDriving(on) {
      driving = on;
      if (!ctx || !engineGain) return;
      engineGain.gain.setTargetAtTime(on ? Math.min(0.09, 0.02 + Math.abs(speed) * 0.003) : 0, ctx.currentTime, 0.1);
    },
    shot() {
      if (!ctx) return;
      // Short noise burst + a falling square blip.
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      src.connect(g); g.connect(master);
      src.start();
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.1);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.12, ctx.currentTime);
      og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(og); og.connect(master);
      osc.start(); osc.stop(ctx.currentTime + 0.12);
    },
    impact() {
      if (!ctx) return;
      tone(70, 0.25, 'sine', 0.35);
      tone(45, 0.3, 'sine', 0.25, 0.02);
    },
    pickup() {
      if (!ctx) return;
      tone(660, 0.09, 'sine', 0.2);
      tone(990, 0.14, 'sine', 0.2, 0.09);
    },
    blip() {
      if (!ctx) return;
      tone(880, 0.06, 'sine', 0.15);
    },
  };
}
