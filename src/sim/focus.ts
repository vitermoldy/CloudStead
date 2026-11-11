import { Emitter } from '../core/emitter';
import { load, save } from '../core/store';

export type Phase = 'focus' | 'short' | 'long';

export const PRESETS = {
  short: { label: '25 menit fokus, 5 menit istirahat', focus: 25, short: 5, long: 15, rounds: 4 },
