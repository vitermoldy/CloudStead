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
