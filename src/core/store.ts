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

