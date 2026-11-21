// PELABUHAN SENJA — audio: WebAudio synthesis only.
//
// No samples, no files, nothing commercial: every sound is an oscillator
// or a burst of generated noise shaped by filters and gain envelopes. The
// engine hums with speed, the siren wails while the player is wanted, a
// gunshot cracks, UI clicks tick, and a short bass-led loop plays under
// the dusk. The context is created on the first user gesture (the start
// button), so autoplay rules never block it, and M or the pause menu mutes
// everything through one master gain. Every method is safe to call before
// unlock: it simply does nothing until the context exists.

const MUSIC_STEPS = [
  // A short dusk loop: Am — F — C — G bass, one step per 240 ms.
  55, 0, 55, 0, 65.41, 0, 55, 0,
  43.65, 0, 43.65, 0, 55, 0, 65.41, 0,
  65.41, 0, 65.41, 0, 82.41, 0, 65.41, 0,
  49, 0, 49, 0, 55, 0, 98, 0,
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this._noiseBuffer = null;
  }

  // Called from a click / key gesture: build the graph once, resume it,
  // and start the engine hum and the music loop.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);

      // Engine: a low sawtooth through a lowpass, pitch and loudness
      // following the car's speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 52;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();

      // Siren: a sine that wails between two tones on a slow LFO.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 750;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.type = 'sine';
      this.sirenLfo.frequency.value = 0.55;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 320;
      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();

      this.startMusic();
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  get ready() {
    return !!this.ctx;
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  _noise() {
    if (this._noiseBuffer) return this._noiseBuffer;
    const len = Math.floor(this.ctx.sampleRate * 0.4);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buf;
    return buf;
  }

  _blip(freq, dur, type, gainValue, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Gunshot: a loud noise burst through a lowpass, gone in 0.18 s.
  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
    src.stop(t + 0.2);
    this._blip(160, 0.09, 'square', 0.18);
  }

  // Crash / wreck: a longer, duller noise thud.
  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
    src.stop(t + 0.55);
  }

  click() {
    this._blip(880, 0.06, 'square', 0.12);
  }

  // One bar of bass, looped quietly under the game; steps advance on a
  // timer, each step a short triangle blip (or silence on a 0 step).
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.muted) {
        this.musicStep = (this.musicStep + 1) % MUSIC_STEPS.length;
        return;
      }
      const freq = MUSIC_STEPS[this.musicStep];
      this.musicStep = (this.musicStep + 1) % MUSIC_STEPS.length;
      if (freq > 0) this._blip(freq, 0.22, 'triangle', 0.11);
    }, 240);
  }

  // Per-frame: engine follows speed, siren follows the wanted level.
  update(_dt, state) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const speed01 = Math.max(0, Math.min(1, state.speed01 ?? 0));
    if (this.engineOsc) {
      this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 110, t, 0.08);
      this.engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.05, t, 0.1);
      this.engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, t, 0.1);
    }
    if (this.sirenGain) {
      const want = (state.wanted ?? 0) > 0 ? 0.045 : 0;
      this.sirenGain.gain.setTargetAtTime(want, t, 0.4);
    }
  }
}
