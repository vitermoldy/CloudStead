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
