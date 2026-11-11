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
