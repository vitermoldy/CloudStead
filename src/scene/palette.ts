import { Color, Vector3 } from 'three';

export type TimeId = 'pagi' | 'siang' | 'senja' | 'malam';

/** One time of day: the sky, the light and the clouds. Senja is the owner's reference. */
export interface Look {
  zenith: string;
