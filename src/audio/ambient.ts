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
