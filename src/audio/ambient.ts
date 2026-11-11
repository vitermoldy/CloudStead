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

