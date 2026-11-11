import { load, save } from '../core/store';

export interface SoundSettings {
  on: boolean;
  volume: number;
  wind: boolean;
  life: boolean;
  keys: boolean;
  effects: boolean;
