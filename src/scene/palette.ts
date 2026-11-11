import { Color, Vector3 } from 'three';

export type TimeId = 'pagi' | 'siang' | 'senja' | 'malam';

/** One time of day: the sky, the light and the clouds. Senja is the owner's reference. */
export interface Look {
  zenith: string;
  horizon: string;
  glow: string;
  sun: string;
  sunIntensity: number;
  /** Direction toward the sun (or the moon at night). */
  sunDir: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  cloudLit: string;
  cloudShade: string;
  fog: string;
  stars: number;
  /** 0 by day, 1 when lamps and screens should light the island. */
  night: number;
  exposure: number;
}

export const LOOKS: Record<TimeId, Look> = {
  pagi: {
    zenith: '#5d7ea6', horizon: '#f0c3a2', glow: '#ffd9b8', sun: '#ffd6ad', sunIntensity: 2.3,
    sunDir: [-0.75, 0.38, 0.45], hemiSky: '#9bb2cf', hemiGround: '#4a3d33', hemiIntensity: 2.0,
    cloudLit: '#fff0e2', cloudShade: '#8b8f9f', fog: '#c9b4a6', stars: 0, night: 0, exposure: 1.0,
  },
  siang: {
