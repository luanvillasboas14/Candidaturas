const PREFIX = 'banco-candidatos:';
export const CACHE_TTL_MS = 10 * 60 * 1000;

type Envelope<T> = { at: number; data: T };

function readStore(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function cacheGet<T>(key: string): T | null {
  const store = readStore();
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || Date.now() - parsed.at > CACHE_TTL_MS) {
      store.removeItem(PREFIX + key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T): void {
  const store = readStore();
  if (!store) return;
  try {
    store.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data } satisfies Envelope<T>));
  } catch {
    // quota cheia: ignora
  }
}

export function cacheClearLista(): void {
  const store = readStore();
  if (!store) return;
  const keys: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key?.startsWith(`${PREFIX}lista:`) || key?.startsWith(`${PREFIX}detalhe:`)) keys.push(key);
  }
  keys.forEach((key) => store.removeItem(key));
}
