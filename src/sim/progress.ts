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
