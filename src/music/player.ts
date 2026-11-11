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
    const item: QueueItem = { id: newId(), ...parsed, title: '', author: '', thumb: '', status: 'ready', error: '' };
    this.queue.push(item);
    this.persist();
    this.emit('change');
    fetchDetails(item).then((d) => {
      const it = this.queue.find((q) => q.id === item.id);
      if (!it) return;
      if (d && d.title) Object.assign(it, { title: d.title, author: d.author || '', thumb: d.thumb || '' });
      if (d && d.error === 'private') Object.assign(it, { status: 'error', error: 'Video atau playlist ini pribadi.' });
      if (d && d.error === 'missing') Object.assign(it, { status: 'error', error: 'YouTube tidak menemukan video atau playlist ini.' });
      this.persist();
      this.emit('change');
    });
    if (playNow || this.current < 0 || this.status === 'ended') this.play(this.queue.length - 1);
    return item;
  }

  remove(index: number): void {
    if (index < 0 || index >= this.queue.length) return;
    const wasCurrent = index === this.current;
    this.queue.splice(index, 1);
    if (index < this.current) this.current--;
    if (wasCurrent) {
      if (this.queue.length === 0) {
        this.current = -1;
        this.stop();
      } else {
        this.current = Math.min(index, this.queue.length - 1);
        if (this.isPlaying) this.play(this.current);
        else this.cue(this.current);
      }
