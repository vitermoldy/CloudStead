import { Emitter } from '../core/emitter';
import { load, save } from '../core/store';

export type Phase = 'focus' | 'short' | 'long';

export const PRESETS = {
  short: { label: '25 menit fokus, 5 menit istirahat', focus: 25, short: 5, long: 15, rounds: 4 },
  long: { label: '50 menit fokus, 10 menit istirahat', focus: 50, short: 10, long: 20, rounds: 3 },
} as const;

export type PresetId = keyof typeof PRESETS;

export const PHASE_LABEL: Record<Phase, string> = { focus: 'Fokus', short: 'Istirahat', long: 'Istirahat panjang' };

interface Saved {
  preset: PresetId;
  phase: Phase;
  round: number;
  running: boolean;
  endAt: number;
  remainingMs: number;
  creditedAt: number;
}

/**
 * A focus timer in real time. While a focus block runs, every elapsed millisecond is handed to
 * onFocusTime, which grows the island. Events: change, finished (phase).
 */
export class FocusTimer extends Emitter {
  preset: PresetId;
  phase: Phase;
  round: number;
  running: boolean;
  endAt: number;
  remainingMs: number;
  private creditedAt: number;
  private readonly persistOn: boolean;

  constructor(private onFocusTime: (ms: number) => void, private onFocusDone: () => void, persist = true) {
    super();
    this.persistOn = persist;
    const s = persist ? load<Partial<Saved>>('focus', {}) : {};
    this.preset = s.preset && s.preset in PRESETS ? s.preset : 'short';
    this.phase = s.phase && ['focus', 'short', 'long'].includes(s.phase) ? s.phase : 'focus';
    this.round = Number.isInteger(s.round) && (s.round as number) > 0 ? (s.round as number) : 1;
    this.running = s.running === true && Number.isFinite(s.endAt);
    this.endAt = Number.isFinite(s.endAt) ? (s.endAt as number) : 0;
    this.remainingMs = Number.isFinite(s.remainingMs) ? (s.remainingMs as number) : this.lengthMs();
    this.creditedAt = Number.isFinite(s.creditedAt) ? (s.creditedAt as number) : Date.now();
  }

  /** Called once the island exists: a block that ran while the page was closed is credited up to its end. */
  resume(): void {
    if (!this.running) return;
    if (this.phase === 'focus') this.credit(Math.min(Date.now(), this.endAt));
    if (Date.now() >= this.endAt) {
      this.running = false;
      this.advance(false);
    }
    this.commit();
  }

  get config() {
    return PRESETS[this.preset];
  }

  get phaseLabel(): string {
    return PHASE_LABEL[this.phase];
  }

  /** True once a block has been started and not reset. */
  get active(): boolean {
    return this.running || this.remainingMs !== this.lengthMs();
  }

  get focusing(): boolean {
    return this.running && this.phase === 'focus';
  }

  get resting(): boolean {
    return this.running && this.phase !== 'focus';
  }

  lengthMs(phase: Phase = this.phase): number {
    const c = this.config;
    return (phase === 'focus' ? c.focus : phase === 'short' ? c.short : c.long) * 60000;
  }

  remaining(): number {
    return this.running ? Math.max(0, this.endAt - Date.now()) : this.remainingMs;
  }

  setPreset(id: PresetId): void {
    if (!(id in PRESETS) || id === this.preset) return;
    this.preset = id;
    this.reset();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.endAt = Date.now() + this.remainingMs;
    this.creditedAt = Date.now();
    this.commit();
  }

  pause(): void {
    if (!this.running) return;
    if (this.phase === 'focus') this.credit(Date.now());
    this.remainingMs = Math.max(0, this.endAt - Date.now());
    this.running = false;
    this.commit();
  }

  toggle(): void {
    if (this.running) this.pause();
    else this.start();
  }

  reset(): void {
    if (this.running && this.phase === 'focus') this.credit(Date.now());
    this.running = false;
    this.phase = 'focus';
    this.round = 1;
    this.remainingMs = this.lengthMs();
    this.commit();
  }

  skip(): void {
    if (this.running && this.phase === 'focus') this.credit(Date.now());
    const was = this.phase;
    this.advance(this.running, false);
    this.commit();
    this.emit('finished', was, true);
