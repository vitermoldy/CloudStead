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
