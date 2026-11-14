// Link to the app's own server (npm run server). Everything here is optional: with
// the server off, or the site opened as static files, the app works exactly as
// before; events wait in the browser and go out once the server answers.
//
// A browser is known by a 12-character recovery code. The browser save is copied
// to the server under that code, so typing the code into another browser brings
// the same progress there.

const APP = 'cloudstead';
const ID_KEY = `${APP}:cloud-id`;
const OUTBOX_KEY = `${APP}:cloud-outbox`;
const SAVED_KEY = `${APP}:cloud-saved`;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE = /^[A-HJ-NP-Z2-9]{12}$/;
const OUTBOX_CAP = 500;

export type CloudStatus = 'unknown' | 'online' | 'offline';
export interface CloudState {
  status: CloudStatus;
  /** Epoch ms the save last reached the server, 0 if never. */
  lastSaved: number;
  /** Events still waiting to be sent. */
  pending: number;
}
interface PendingEvent {
  kind: string;
  at: number;
  day: string;
  data: unknown;
}

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

let code = read(ID_KEY) ?? '';
if (!CODE.test(code)) {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  write(ID_KEY, code);
}

/** The recovery code, grouped for reading: ABCD-EFGH-JKLM. */
export const recoveryCode = (): string => (code.match(/.{4}/g) ?? [code]).join('-');

let status: CloudStatus = 'unknown';
let lastSaved = Number(read(SAVED_KEY)) || 0;
let frozen = false;
const listeners = new Set<(state: CloudState) => void>();
const notify = (): void => listeners.forEach((fn) => fn(cloudState()));
const setStatus = (next: CloudStatus): void => {
  if (next !== status) {
    status = next;
    notify();
  }
};

export function cloudState(): CloudState {
  return { status, lastSaved, pending: outbox().length };
}

export function onCloud(fn: (state: CloudState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(body.error || `HTTP ${res.status}`, res.status);
  return body;
}

/** A thrown ApiError means the server answered; anything else means it could not be reached. */
const reached = (err: unknown): boolean => err instanceof ApiError;

function outbox(): PendingEvent[] {
  try {
    const list = JSON.parse(read(OUTBOX_KEY) || '[]') as unknown;
    return Array.isArray(list) ? (list as PendingEvent[]) : [];
  } catch {
    return [];
  }
}

const localDay = (t = new Date()): string =>
  `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

/** Records something that happened; it is sent now, or later if the server is away. */
export function logEvent(kind: string, data: unknown): void {
  const list = outbox();
  list.push({ kind, at: Date.now(), day: localDay(), data });
  write(OUTBOX_KEY, JSON.stringify(list.slice(-OUTBOX_CAP)));
  notify();
  void flushEvents();
}

let flushing = false;
export async function flushEvents(): Promise<void> {
  if (flushing) return;
  const list = outbox();
  if (list.length === 0) return;
  flushing = true;
  const batch = list.slice(0, 200);
  try {
    await api('/events', { method: 'POST', body: JSON.stringify({ device: code, events: batch }) });
    // Only what was sent leaves the queue; anything logged meanwhile stays.
    write(OUTBOX_KEY, JSON.stringify(outbox().slice(batch.length)));
    setStatus('online');
    notify();
  } catch (err) {
    // A 4xx means the batch itself is unusable; drop it rather than retry it forever.
    if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429) {
      write(OUTBOX_KEY, JSON.stringify(outbox().slice(batch.length)));
    }
    setStatus(reached(err) ? 'online' : 'offline');
  } finally {
    flushing = false;
  }
  if (outbox().length > 0 && status === 'online') void flushEvents();
}

let saveTimer = 0;
let saveText = '';
/** Copies the browser save (its JSON text) to the server, a moment after the last change. */
export function mirrorSave(text: string): void {
  if (!text || frozen) return;
  saveText = text;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void pushSave(), 2000);
}

/** `leaving`: the tab is being hidden or closed, so the request must outlive the page (keepalive). */
async function pushSave(leaving = false): Promise<void> {
  if (!saveText || frozen) return;
  clearTimeout(saveTimer);
  try {
    await api('/save', { method: 'PUT', body: JSON.stringify({ device: code, data: saveText }), keepalive: leaving });
    lastSaved = Date.now();
    write(SAVED_KEY, String(lastSaved));
    setStatus('online');
    notify();
  } catch (err) {
    setStatus(reached(err) ? 'online' : 'offline');
  }
}

/** This browser's totals from the server, or null when it cannot be reached. */
export async function fetchStats<T>(days = 14): Promise<T | null> {
  try {
    const stats = await api<T>(`/stats/${code}?days=${days}&today=${localDay()}`);
    setStatus('online');
    return stats;
  } catch (err) {
    setStatus(reached(err) ? 'online' : 'offline');
    return null;
  }
}

/**
 * Fetches the save stored under another recovery code. The caller writes the
 * returned JSON text over its own save and reloads; from then on this browser
 * shares that code. Nothing is mirrored after this call, so the old save cannot
 * overwrite the restored one on the way out.
 */
export async function restoreFrom(input: string): Promise<string> {
  const wanted = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!CODE.test(wanted)) throw Object.assign(new Error('Kode pemulihan terdiri dari 12 huruf dan angka.'), { code: 'format' });
  const body = await api<{ data: string }>(`/save/${wanted}`).catch((err: unknown) => {
    if (reached(err)) throw err;
    throw Object.assign(new Error('Server tidak terhubung. Jalankan server dulu, lalu coba lagi.'), { code: 'offline' });
  });
  frozen = true;
  clearTimeout(saveTimer);
  code = wanted;
  write(ID_KEY, code);
  return body.data;
}

addEventListener('online', () => void flushEvents());
addEventListener('pagehide', () => {
  if (saveText && !frozen) void pushSave(true);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && saveText && !frozen) void pushSave(true);
  else void flushEvents();
