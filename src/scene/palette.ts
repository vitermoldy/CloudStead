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
    zenith: '#3f78b8', horizon: '#cfe0ea', glow: '#fff4dc', sun: '#fff3e0', sunIntensity: 2.8,
    sunDir: [0.35, 0.86, 0.3], hemiSky: '#b6cde3', hemiGround: '#55483a', hemiIntensity: 2.2,
    cloudLit: '#ffffff', cloudShade: '#a3afbf', fog: '#c6d6e2', stars: 0, night: 0, exposure: 0.95,
  },
  senja: {
    zenith: '#1c2130', horizon: '#c48a55', glow: '#ffc27a', sun: '#ffbd70', sunIntensity: 3.6,
    sunDir: [0.86, 0.36, 0.28], hemiSky: '#7b7e8f', hemiGround: '#4a3828', hemiIntensity: 1.9,
    cloudLit: '#f7c47f', cloudShade: '#3d3f4c', fog: '#8f7562', stars: 0.08, night: 0.35, exposure: 1.0,
  },
  malam: {
    zenith: '#060a14', horizon: '#1b2840', glow: '#6f86ad', sun: '#a9bfe6', sunIntensity: 1.5,
    sunDir: [-0.5, 0.62, 0.35], hemiSky: '#3a4a6c', hemiGround: '#1a1814', hemiIntensity: 2.6,
    cloudLit: '#6878a0', cloudShade: '#1a2030', fog: '#1a2436', stars: 1, night: 1, exposure: 1.3,
  },
};

/** The look the real clock asks for, blended across the hour of change. */
export function lookForHour(hour: number): { a: TimeId; b: TimeId; t: number } {
  // pagi 5-7, siang 7-16, senja 16-19, malam 19-5; each change takes an hour.
  const stops: [number, TimeId][] = [[5, 'pagi'], [7.5, 'siang'], [16.5, 'senja'], [19, 'malam']];
  const h = ((hour % 24) + 24) % 24;
  for (let i = stops.length - 1; i >= 0; i--) {
    const [at, id] = stops[(i + stops.length) % stops.length];
    if (h >= at) {
      const prev = stops[(i - 1 + stops.length) % stops.length][1];
      const t = Math.min(1, (h - at) / 1);
      return { a: prev, b: id, t };
    }
  }
  return { a: 'senja', b: 'malam', t: 1 };
}

/** A look as live three.js values, blended in place. */
export class LiveLook {
  zenith = new Color();
  horizon = new Color();
  glow = new Color();
  sun = new Color();
  sunIntensity = 1;
  sunDir = new Vector3();
  hemiSky = new Color();
  hemiGround = new Color();
  hemiIntensity = 1;
  cloudLit = new Color();
  cloudShade = new Color();
  fog = new Color();
  stars = 0;
  night = 0;
  exposure = 1;

  private static tmpA = new Color();
  private static tmpB = new Color();

  set(a: Look, b: Look = a, t = 0): void {
    const c = (key: 'zenith' | 'horizon' | 'glow' | 'sun' | 'hemiSky' | 'hemiGround' | 'cloudLit' | 'cloudShade' | 'fog') => {
      LiveLook.tmpA.set(a[key]);
