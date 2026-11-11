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
