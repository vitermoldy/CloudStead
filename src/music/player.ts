import { Emitter, clamp } from '../core/emitter';
import { load, save } from '../core/store';
import { parseLink, loadYouTubeApi, fetchDetails, ERROR_TEXT, LinkError, type ParsedLink, type YTPlayer } from './links';

export interface QueueItem extends ParsedLink {
  id: string;
  title: string;
  author: string;
  thumb: string;
  status: 'ready' | 'error';
  error: string;
}

export type MusicStatus = 'idle' | 'loading-api' | 'loading' | 'playing' | 'paused' | 'buffering' | 'ended' | 'api-error';

let uid = 0;
const newId = () => `q${Date.now().toString(36)}${(uid++).toString(36)}`;

/** The music queue and the YouTube embed that plays it. Event: change. */
export class MusicPlayer extends Emitter {
  queue: QueueItem[];
  current: number;
  volume: number;
  loop: boolean;
  status: MusicStatus = 'idle';
  nowTitle = '';
  apiError = '';
  private player: YTPlayer | null = null;
  private ready = false;
