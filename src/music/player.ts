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
    }
    this.persist();
    this.emit('change');
  }

  setVolume(v: number): void {
    this.volume = clamp(Math.round(v), 0, 100);
    if (this.ready && this.player) this.player.setVolume(this.volume);
    this.persist();
    this.emit('change');
  }

  setLoop(on: boolean): void {
    this.loop = on;
    this.persist();
    this.emit('change');
  }

  private async ensurePlayer(): Promise<boolean> {
    if (this.ready) return true;
    if (this.creating) return this.creating;
    this.status = 'loading-api';
    this.apiError = '';
    this.emit('change');
    this.creating = (async () => {
      try {
        const YT = await loadYouTubeApi();
        await new Promise<void>((resolve) => {
          const mount = document.createElement('div');
          this.host.replaceChildren(mount);
          this.player = new YT.Player(mount, {
            width: '100%',
            height: '100%',
            playerVars: { playsinline: 1, rel: 0, origin: location.origin },
            events: {
              onReady: () => {
                this.ready = true;
                this.player!.setVolume(this.volume);
                resolve();
              },
              onStateChange: (e: { data: number }) => this.onState(e.data),
              onError: (e: { data: number }) => this.onError(e.data),
            },
          });
        });
        return true;
      } catch (err) {
        this.status = 'api-error';
        this.apiError = err instanceof Error && err.message === 'timeout'
          ? 'YouTube terlalu lama menjawab. Periksa koneksi, lalu coba lagi.'
          : 'YouTube tidak termuat. Periksa koneksi atau pemblokir iklan, lalu coba lagi.';
        this.emit('change');
        return false;
      } finally {
        this.creating = null;
      }
    })();
    return this.creating;
  }

  private async load(index: number, autoplay: boolean): Promise<void> {
    const item = this.queue[index];
    if (!item) return;
    this.current = index;
    this.nowTitle = '';
    if (item.status === 'error') item.status = 'ready';
    item.error = '';
    this.persist();
    this.emit('change');
    if (!(await this.ensurePlayer()) || !this.player) return;
    this.status = autoplay ? 'loading' : 'paused';
