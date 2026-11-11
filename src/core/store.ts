// Persistence. Every read and write is wrapped: a private window, blocked storage or a full
// quota must never break the app. In preview mode (?pratinjau=) nothing is written at all.

const KEY = 'cloudstead:v1';

type Bag = Record<string, unknown>;

let cache: Bag | null = null;
let readOnly = false;
let timer = 0;
let lastWrite = 0;
const listeners = new Set<(at: number) => void>();

function readAll(): Bag {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    cache = {};
  }
  return cache!;
}

function flush(): boolean {
  timer = 0;
  if (readOnly) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(readAll()));
    lastWrite = Date.now();
    for (const fn of listeners) fn(lastWrite);
    return true;
  } catch {
    return false;
  }
}

/** Preview mode: the page shows a borrowed state and never touches the visitor's save. */
export function setReadOnly(on: boolean): void {
  readOnly = on;
  if (on) cache = {};
}

export const isReadOnly = (): boolean => readOnly;

export function load<T>(section: string, fallback: T): T {
  const value = readAll()[section];
  if (value === undefined || value === null) return fallback;
  if (fallback && typeof fallback === 'object' && !Array.isArray(fallback) && typeof value === 'object') {
    return { ...fallback, ...(value as object) } as T;
  }
  return value as T;
}

