import { load, save } from '../core/store';

export interface SoundSettings {
  on: boolean;
  volume: number;
  wind: boolean;
  life: boolean;
  keys: boolean;
  effects: boolean;
}

const DEFAULTS: SoundSettings = { on: true, volume: 45, wind: true, life: true, keys: true, effects: true };

/**
 * The island's own sound, made in the browser: wind over the clouds, birds by day and crickets at
 * night, the resident's keys, and small effects for building. It starts on the first gesture.
 */
export class Ambient {
  settings: SoundSettings;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private lifeGain: GainNode | null = null;
  private keyGain: GainNode | null = null;
  private fxGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private night = 0;
  private typing = false;
  private ducked = false;
  private hidden = false;
  private timers: number[] = [];

  constructor() {
    this.settings = { ...DEFAULTS, ...load<Partial<SoundSettings>>('sound', {}) };
  }

  get started(): boolean {
    return this.ctx !== null;
  }

  /** Call from a user gesture. */
  start(): void {
    if (this.ctx || !this.settings.on) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // Brown-ish noise: softer than white, closer to wind.
      last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
      data[i] = last * 3.5;
    }
    this.windGain = ctx.createGain();
    this.lifeGain = ctx.createGain();
    this.keyGain = ctx.createGain();
    this.fxGain = ctx.createGain();
    for (const g of [this.windGain, this.lifeGain, this.keyGain, this.fxGain]) g.connect(this.master);
    this.startWind();
    this.loopLife();
    this.loopKeys();
    this.apply();
  }

  private startWind(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    lp.Q.value = 0.6;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(lp.frequency);
    const swell = ctx.createOscillator();
    const swellGain = ctx.createGain();
    swell.frequency.value = 0.09;
    swellGain.gain.value = 0.25;
    const base = ctx.createGain();
    base.gain.value = 0.55;
    swell.connect(swellGain).connect(base.gain);
    src.connect(lp).connect(base).connect(this.windGain!);
    src.start();
    lfo.start();
    swell.start();
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private loopLife(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.night > 0.6) this.cricket();
    else this.bird();
    this.later(this.night > 0.6 ? 900 + Math.random() * 1600 : 2500 + Math.random() * 6000, () => this.loopLife());
  }

  private bird(): void {
    const ctx = this.ctx!;
    const n = 2 + Math.floor(Math.random() * 3);
    const base = 2600 + Math.random() * 1400;
    let t = ctx.currentTime + 0.02;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), t + 0.07);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(g).connect(this.lifeGain!);
      o.start(t);
      o.stop(t + 0.12);
      t += 0.12 + Math.random() * 0.08;
    }
  }

  private cricket(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.02;
    const o = ctx.createOscillator();
    const am = ctx.createOscillator();
    const amGain = ctx.createGain();
    const g = ctx.createGain();
    o.frequency.value = 4300 + Math.random() * 400;
    am.frequency.value = 38;
    amGain.gain.value = 0.5;
    g.gain.value = 0;
    am.connect(amGain).connect(g.gain);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.018, t + 0.03);
    g.gain.linearRampToValueAtTime(0, t + 0.32);
    o.connect(g).connect(this.lifeGain!);
    o.start(t);
    am.start(t);
    o.stop(t + 0.35);
    am.stop(t + 0.35);
  }

  private loopKeys(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    let wait = 120 + Math.random() * 140;
    if (this.typing && this.settings.keys && !this.hidden) {
      this.key();
      // Words come in bursts, with a pause to think now and then.
      if (Math.random() < 0.08) wait += 500 + Math.random() * 900;
    } else {
      wait = 400;
    }
    this.later(wait, () => this.loopKeys());
  }

  private key(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.005;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 + Math.random() * 1500;
    bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(bp).connect(g).connect(this.keyGain!);
    src.start(t, Math.random() * 1.5, 0.06);
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', at = 0, slideTo?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.settings.effects) return;
    const t = ctx.currentTime + 0.01 + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.fxGain!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** The resident's work, beat by beat: hammer, shovel, watering can, rope. Under the "work" switch. */
  work(kind: 'hammer' | 'dig' | 'water' | 'haul'): void {
    const ctx = this.ctx;
    if (!ctx || !this.settings.keys || this.hidden) return;
    if (kind === 'hammer') this.knock(true);
    else if (kind === 'dig') this.burst(320, 0.18, 0.5, 0.9);
    else if (kind === 'water') this.burst(3200, 0.25, 0.12, 0.4);
    else this.creak();
  }

  /** A short filtered noise: earth for a shovel, a trickle for water. */
  private burst(freq: number, dur: number, gain: number, q: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.keyGain!);
    src.start(t, Math.random() * 1.2, dur + 0.05);
  }

  /** A rope pulled tight over the edge. */
  private creak(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140 + Math.random() * 30, t);
    o.frequency.linearRampToValueAtTime(95, t + 0.25);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(lp).connect(g).connect(this.keyGain!);
    o.start(t);
    o.stop(t + 0.32);
  }

  knock(work = false): void {
    if (work) {
      // On the work channel, so the "work" switch silences it.
      const ctx = this.ctx!;
      const t = ctx.currentTime + 0.01;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(200, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g).connect(this.keyGain!);
      o.start(t);
      o.stop(t + 0.16);
      return;
    }
    this.tone(190, 0.14, 0.4, 'triangle', 0, 120);
    this.tone(900, 0.04, 0.08, 'square');
  }

  pop(): void {
    this.tone(660, 0.5, 0.12);
    this.tone(990, 0.6, 0.09, 'sine', 0.09);
  }

  land(): void {
    this.tone(95, 0.35, 0.45, 'sine', 0, 55);
  }

