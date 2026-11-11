import { Emitter } from '../core/emitter';
import { load, save, saveNow } from '../core/store';
import { MILESTONES, type Milestone } from './milestones';

export interface ProgressData {
  focusMs: number;
  todayMs: number;
  todayDate: string;
  sessions: number;
  /** Milestone id -> ISO date it was reached. */
  reachedAt: Record<string, string>;
  startedAt: string;
  name: string;
}

export const DEFAULT_NAME = 'VMK';
/** The name the first version gave the resident; saves that still carry it move to the new default. */
const OLD_DEFAULT = 'Bayu';

const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fresh = (): ProgressData => ({
  focusMs: 0,
  todayMs: 0,
  todayDate: today(),
  sessions: 0,
  reachedAt: {},
  startedAt: new Date().toISOString(),
  name: DEFAULT_NAME,
});

/**
 * Focus time and what it has built. Events:
 * change, reach (milestone), saved.
 */
export class Progress extends Emitter {
  data: ProgressData;
  private unsavedMs = 0;

  constructor(previewMinutes: number | null = null) {
    super();
    if (previewMinutes !== null) {
      this.data = fresh();
      this.data.focusMs = previewMinutes * 60000;
      for (const m of MILESTONES) if (m.minutes <= previewMinutes) this.data.reachedAt[m.id] = this.data.startedAt;
    } else {
      this.data = this.read();
    }
  }

  private read(): ProgressData {
    const raw = load<Partial<ProgressData>>('progress', {});
    const d = { ...fresh(), ...raw };
    if (!Number.isFinite(d.focusMs) || d.focusMs < 0) d.focusMs = 0;
    if (!Number.isFinite(d.todayMs) || d.todayMs < 0) d.todayMs = 0;
    if (!Number.isInteger(d.sessions) || d.sessions < 0) d.sessions = 0;
    if (!d.reachedAt || typeof d.reachedAt !== 'object') d.reachedAt = {};
    if (typeof d.name !== 'string' || !d.name.trim() || d.name === OLD_DEFAULT) d.name = DEFAULT_NAME;
    d.name = d.name.slice(0, 18);
    // Anything the time already covers counts as reached, even from an older save.
    for (const m of MILESTONES) if (m.minutes * 60000 <= d.focusMs && !d.reachedAt[m.id]) d.reachedAt[m.id] = new Date().toISOString();
    return d;
  }

  reload(): void {
    this.data = this.read();
    this.emit('change');
  }

  get minutes(): number {
    return this.data.focusMs / 60000;
  }

  get todayMinutes(): number {
    return this.data.todayDate === today() ? this.data.todayMs / 60000 : 0;
  }

  get name(): string {
    return this.data.name;
  }

  isReached(m: Milestone): boolean {
    return Boolean(this.data.reachedAt[m.id]);
  }

  reached(): Milestone[] {
    return MILESTONES.filter((m) => this.isReached(m));
  }

  next(): Milestone | null {
    return MILESTONES.find((m) => !this.isReached(m)) ?? null;
  }

  /** The milestone before the next one, for the meter's start. */
  previousMinutes(): number {
    const done = this.reached();
    return done.length ? done[done.length - 1].minutes : 0;
  }

  /** Adds focus time. Emits 'reach' for every milestone it passes, in order. */
  add(ms: number): void {
    if (!(ms > 0)) return;
    const d = this.data;
    if (d.todayDate !== today()) {
      d.todayDate = today();
      d.todayMs = 0;
    }
    d.focusMs += ms;
    d.todayMs += ms;
    this.unsavedMs += ms;
    const passed: Milestone[] = [];
    for (const m of MILESTONES) {
      if (!d.reachedAt[m.id] && m.minutes * 60000 <= d.focusMs) {
        d.reachedAt[m.id] = new Date().toISOString();
        passed.push(m);
