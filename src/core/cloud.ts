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
