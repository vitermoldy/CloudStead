// Reads YouTube and YouTube Music links into what the embed player needs.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^[A-Za-z0-9_-]{10,64}$/;

export class LinkError extends Error {}

export interface ParsedLink {
  kind: 'video' | 'playlist';
  videoId: string | null;
  listId: string | null;
  source: 'YouTube' | 'YouTube Music';
  url: string;
}

/** Throws LinkError with a sentence the visitor can act on. */
export function parseLink(raw: string): ParsedLink {
  const text = String(raw || '').trim();
  if (!text) throw new LinkError('Tempel tautannya dulu.');
  if (VIDEO_ID.test(text)) return { kind: 'video', videoId: text, listId: null, source: 'YouTube', url: `https://www.youtube.com/watch?v=${text}` };

  const notLink = 'Itu bukan tautan. Salin dari bilah alamat atau tombol Bagikan.';
  if (/\s/.test(text) || !text.includes('.')) throw new LinkError(notLink);
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    throw new LinkError(notLink);
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  const known = ['youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'];
  if (!known.includes(host)) throw new LinkError('Yang bisa diputar di sini hanya tautan YouTube dan YouTube Music.');
  const source = host === 'music.youtube.com' ? 'YouTube Music' : 'YouTube';

  let videoId: string | null = null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be') videoId = parts[0] || null;
  else if (url.pathname === '/watch') videoId = url.searchParams.get('v');
  else if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) videoId = parts[1] || null;
  if (videoId && !VIDEO_ID.test(videoId)) videoId = null;

  let listId = url.searchParams.get('list');
  if (listId && !LIST_ID.test(listId)) listId = null;
  // Mixes (RD...), liked songs (LL, LM) and Watch later (WL) do not play outside YouTube.
  const unplayable = listId && (/^RD/.test(listId) || listId === 'LL' || listId === 'WL' || listId === 'LM');
  if (unplayable) {
    if (videoId) listId = null;
    else throw new LinkError('Mix dan daftar pribadi tidak bisa diputar di luar YouTube. Tempel satu lagu, album, atau playlist publik.');
  }

  if (!videoId && !listId) throw new LinkError('Tautan ini tidak berisi video atau playlist. Buka lagunya, lalu salin lagi tautannya.');
  const kind = listId ? 'playlist' : 'video';
  const clean = kind === 'playlist' ? `https://www.youtube.com/playlist?list=${listId}` : `https://www.youtube.com/watch?v=${videoId}`;
  return { kind, videoId, listId, source, url: clean };
}

interface YTNamespace {
  Player: new (el: HTMLElement, opts: unknown) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number; ENDED: number };
}

export interface YTPlayer {
  setVolume(v: number): void;
  loadVideoById(id: string): void;
  cueVideoById(id: string): void;
  loadPlaylist(o: unknown): void;
  cuePlaylist(o: unknown): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  nextVideo(): void;
  previousVideo(): void;
  playVideoAt(i: number): void;
  seekTo(s: number, allow: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlaylist(): string[] | null;
  getPlaylistIndex(): number;
  getVideoData(): { title?: string; author?: string };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/** Loads the YouTube IFrame API once; rejects after 15 s. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      apiPromise = null;
      reject(new Error('timeout'));
    }, 15000);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      if (typeof prev === 'function') prev();
      resolve(window.YT as YTNamespace);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      clearTimeout(timer);
      apiPromise = null;
      s.remove();
      reject(new Error('network'));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

export interface Details {
  title?: string;
  author?: string;
  thumb?: string;
  error?: 'private' | 'missing' | null;
