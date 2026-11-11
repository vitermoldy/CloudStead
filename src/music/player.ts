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
  private creating: Promise<boolean> | null = null;
  private seekToVideo: string | null = null;

  constructor(private host: HTMLElement) {
    super();
    const saved = load<{ queue?: QueueItem[]; current?: number; volume?: number; loop?: boolean }>('music', {});
    this.queue = Array.isArray(saved.queue)
      ? saved.queue.filter((q) => q && (q.videoId || q.listId)).map((q) => ({ ...q, status: q.status === 'error' ? 'error' : 'ready' }))
      : [];
    this.current = Number.isInteger(saved.current) && (saved.current as number) < this.queue.length ? (saved.current as number) : -1;
    this.volume = Number.isFinite(saved.volume) ? clamp(saved.volume as number, 0, 100) : 70;
    this.loop = saved.loop !== false;
  }

  get item(): QueueItem | null {
    return this.queue[this.current] || null;
  }

  get isPlaying(): boolean {
    return this.status === 'playing' || this.status === 'buffering';
  }

  /** Adds a link and returns it, or throws LinkError. */
  add(raw: string, playNow = false): QueueItem {
    const parsed = parseLink(raw);
    const dup = this.queue.findIndex((q) => q.videoId === parsed.videoId && q.listId === parsed.listId);
    if (dup >= 0) {
      if (playNow || this.current < 0) this.play(dup);
      throw new LinkError(this.current === dup ? 'Tautan itu sedang diputar.' : 'Tautan itu sudah ada di antrean.');
    }
