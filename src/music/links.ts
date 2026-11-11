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
