import { Point } from '../lighting/Raycaster';

const MAX_HEARING_RANGE = 900;

/**
 * Procedural Web Audio sound synthesizer — HUSHFIRE ships no audio assets,
 * so every effect (gunshots, footsteps, zombie groans) is generated from
 * noise buffers and oscillators, then panned/filtered relative to the
 * listener to fake spatial occlusion.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.6;
    this.masterGain.connect(this.ctx.destination);
    this.noiseBuffer = this.buildNoiseBuffer(this.ctx);
    return this.ctx;
  }

  /** Call from a user gesture (click/keydown) to unlock audio on browsers that require it. */
  resume() {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private spatialParams(source: Point, listener: Point, wallsCrossed: number) {
    const dx = source.x - listener.x;
    const dy = source.y - listener.y;
    const dist = Math.hypot(dx, dy);
    const volume = Math.max(0, 1 - dist / MAX_HEARING_RANGE);
    const pan = Math.max(-1, Math.min(1, dx / 500));
    const occlusion = Math.max(0.12, 1 - wallsCrossed * 0.35);
    return { volume, pan, occlusion };
  }

  private playNoiseBurst(ctx: AudioContext, listener: Point, source: Point, wallsCrossed: number, opts: { duration: number; startFreq: number; endFreq: number; gain: number }) {
    if (!this.noiseBuffer || !this.masterGain) return;
    const { volume, pan, occlusion } = this.spatialParams(source, listener, wallsCrossed);
    if (volume <= 0.01) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(opts.startFreq * occlusion, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, opts.endFreq * occlusion), ctx.currentTime + opts.duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(opts.gain * volume * occlusion, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + opts.duration);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    src.connect(filter).connect(gain).connect(panner).connect(this.masterGain);
    src.start();
    src.stop(ctx.currentTime + opts.duration);
  }

  playGunshot(listener: Point, source: Point, wallsCrossed: number, suppressed: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playNoiseBurst(ctx, listener, source, wallsCrossed, {
      duration: suppressed ? 0.08 : 0.22,
      startFreq: suppressed ? 2200 : 5200,
      endFreq: 300,
      gain: suppressed ? 0.35 : 0.9
    });
  }

  playFootstep(listener: Point, source: Point, wallsCrossed: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playNoiseBurst(ctx, listener, source, wallsCrossed, {
      duration: 0.06,
      startFreq: 900,
      endFreq: 200,
      gain: 0.12
    });
  }

  playZombieGroan(listener: Point, source: Point, wallsCrossed: number, enraged: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const { volume, pan, occlusion } = this.spatialParams(source, listener, wallsCrossed);
    if (volume <= 0.01) return;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const baseFreq = enraged ? 140 : 70;
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(baseFreq * (enraged ? 1.6 : 1.1), ctx.currentTime + 0.4);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500 * occlusion;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25 * volume * occlusion, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    osc.connect(filter).connect(gain).connect(panner).connect(this.masterGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }

  /** Shared oscillator voice — one pitch sweep with an attack/decay envelope. */
  private playVoice(
    listener: Point,
    source: Point,
    wallsCrossed: number,
    opts: {
      type: OscillatorType;
      startFreq: number;
      endFreq: number;
      duration: number;
      gain: number;
      attack?: number;
      lowpass?: number;
    }
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const { volume, pan, occlusion } = this.spatialParams(source, listener, wallsCrossed);
    if (volume <= 0.01) return;

    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFreq), ctx.currentTime + opts.duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = (opts.lowpass ?? 4000) * occlusion;

    const attack = opts.attack ?? 0.01;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(opts.gain * volume * occlusion, ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + opts.duration);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    osc.connect(filter).connect(gain).connect(panner).connect(this.masterGain);
    osc.start();
    osc.stop(ctx.currentTime + opts.duration);
  }

  playZombieDeath(listener: Point, source: Point, wallsCrossed: number) {
    this.playVoice(listener, source, wallsCrossed, {
      type: 'sawtooth',
      startFreq: 180,
      endFreq: 40,
      duration: 0.55,
      gain: 0.3,
      lowpass: 900
    });
    const ctx = this.ensureContext();
    if (ctx) {
      this.playNoiseBurst(ctx, listener, source, wallsCrossed, {
        duration: 0.25,
        startFreq: 1600,
        endFreq: 200,
        gain: 0.25
      });
    }
  }

  playPlayerHit(listener: Point, source: Point) {
    this.playVoice(listener, source, 0, {
      type: 'triangle',
      startFreq: 220,
      endFreq: 60,
      duration: 0.18,
      gain: 0.45,
      lowpass: 1200
    });
  }

  playRevive(listener: Point, source: Point) {
    this.playVoice(listener, source, 0, { type: 'sine', startFreq: 420, endFreq: 880, duration: 0.35, gain: 0.3 });
  }

  playObjectiveComplete(listener: Point, source: Point) {
    this.playVoice(listener, source, 0, { type: 'square', startFreq: 520, endFreq: 780, duration: 0.18, gain: 0.22 });
    window.setTimeout(
      () => this.playVoice(listener, source, 0, { type: 'square', startFreq: 780, endFreq: 1040, duration: 0.25, gain: 0.22 }),
      160
    );
  }

  playSiren(listener: Point, source: Point) {
    this.playVoice(listener, source, 0, { type: 'sawtooth', startFreq: 440, endFreq: 880, duration: 0.9, gain: 0.3, attack: 0.15, lowpass: 2200 });
    window.setTimeout(
      () => this.playVoice(listener, source, 0, { type: 'sawtooth', startFreq: 880, endFreq: 440, duration: 0.9, gain: 0.3, attack: 0.15, lowpass: 2200 }),
      900
    );
  }

  playDryFire(listener: Point, source: Point) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playNoiseBurst(ctx, listener, source, 0, { duration: 0.05, startFreq: 5000, endFreq: 1200, gain: 0.3 });
  }

  playPickup(listener: Point, source: Point) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const { volume, pan } = this.spatialParams(source, listener, 0);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.12);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2 * volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    osc.connect(gain).connect(panner).connect(this.masterGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }
}
