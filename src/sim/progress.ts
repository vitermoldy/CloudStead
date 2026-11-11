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
