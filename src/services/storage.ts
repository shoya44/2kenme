import type { RelaxLevel } from '../utils/relax';
import type { GeoPoint, HistoryEntry, SearchCondition, Shop } from '../types';

const KEYS = {
  defaults: 'tsugidoko:defaults',
  history: 'tsugidoko:history',
  session: 'tsugidoko:session',
  geo: 'tsugidoko:geo',
} as const;

/** セッションの有効期限。iOSのPWAは破棄されやすいためTTL付きlocalStorageに置く（DATA-001 §2）。 */
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

/** 現在地の鮮度。これを過ぎたら取り直す（DATA-001 §6）。 */
export const GEO_TTL_MS = 30 * 60 * 1000;

/** 履歴の保持件数（DATA-001 §11）。 */
export const HISTORY_LIMIT = 20;

export const DEFAULT_CONDITION: SearchCondition = {
  budgetMax: 4000,
  genreCode: null,
  preferences: { privateRoom: false, freeDrink: false, midnight: false },
  range: 3,
};

/** 現在の提示状態（DATA-001 §7）。現在地は含めない。 */
export interface SearchSession {
  condition: SearchCondition;
  relaxLevel: RelaxLevel;
  currentShop: Shop | null;
  queue: Shop[];
  shownIds: string[];
  nextStart: number;
  hasMore: boolean;
  startedAt: number;
}

/**
 * Web Storage は環境によって参照そのものが例外を投げる（プライベートブラウズ等）。
 * 永続化は必須機能ではないため、取得できなければ無効として扱う（DATA-001 §13）。
 */
function storage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function read<T>(kind: 'local' | 'session', key: string): T | null {
  const store = storage(kind);
  if (!store) {
    return null;
  }

  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    // 壊れた値は捨てて初期値で続ける。アプリ全体は止めない
    remove(kind, key);
    return null;
  }
}

function write(kind: 'local' | 'session', key: string, value: unknown): void {
  const store = storage(kind);
  if (!store) {
    return;
  }
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // QuotaExceededError 等。書けなくてもアプリは続行する
  }
}

function remove(kind: 'local' | 'session', key: string): void {
  const store = storage(kind);
  if (!store) {
    return;
  }
  try {
    store.removeItem(key);
  } catch {
    // 何もしない
  }
}

/* ---------------- defaults ---------------- */

function isValidCondition(value: unknown): value is SearchCondition {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const c = value as Partial<SearchCondition>;
  return (
    (c.budgetMax === null || typeof c.budgetMax === 'number') &&
    (c.genreCode === null || typeof c.genreCode === 'string') &&
    typeof c.range === 'number' &&
    c.range >= 1 &&
    c.range <= 4 &&
    typeof c.preferences === 'object' &&
    c.preferences !== null
  );
}

export function loadDefaults(): SearchCondition {
  const stored = read<unknown>('local', KEYS.defaults);
  if (!isValidCondition(stored)) {
    return DEFAULT_CONDITION;
  }
  return {
    ...DEFAULT_CONDITION,
    ...stored,
    preferences: { ...DEFAULT_CONDITION.preferences, ...stored.preferences },
  };
}

export function saveDefaults(condition: SearchCondition): void {
  write('local', KEYS.defaults, condition);
}

export function clearDefaults(): void {
  remove('local', KEYS.defaults);
}

/* ---------------- history ---------------- */

export function loadHistory(): HistoryEntry[] {
  const stored = read<unknown>('local', KEYS.history);
  if (!Array.isArray(stored)) {
    return [];
  }
  return stored.filter(
    (e): e is HistoryEntry =>
      typeof e === 'object' && e !== null && typeof (e as HistoryEntry).shopId === 'string',
  );
}

/**
 * OKした店舗を履歴の先頭へ積む。
 * 同一店舗は1件だけ残し、上限を超えたら最古を落とす（DATA-001 §11）。
 */
export function addHistory(shop: Shop, now = Date.now()): HistoryEntry[] {
  const entry: HistoryEntry = {
    shopId: shop.id,
    name: shop.name,
    hotpepperUrl: shop.hotpepperUrl,
    budgetText: shop.budgetText,
    walkMinutes: shop.walkMinutes,
    decidedAt: now,
  };

  const next = [entry, ...loadHistory().filter((e) => e.shopId !== shop.id)].slice(
    0,
    HISTORY_LIMIT,
  );

  write('local', KEYS.history, next);
  return next;
}

export function clearHistory(): void {
  remove('local', KEYS.history);
}

/* ---------------- session ---------------- */

export function loadSession(now = Date.now()): SearchSession | null {
  const stored = read<SearchSession>('local', KEYS.session);
  if (!stored || typeof stored.startedAt !== 'number') {
    return null;
  }
  if (now - stored.startedAt > SESSION_TTL_MS) {
    clearSession();
    return null;
  }
  return stored;
}

export function saveSession(session: SearchSession): void {
  write('local', KEYS.session, session);
}

export function clearSession(): void {
  remove('local', KEYS.session);
}

/* ---------------- geo ---------------- */

export function loadGeo(now = Date.now()): GeoPoint | null {
  const stored = read<GeoPoint>('session', KEYS.geo);
  if (!stored || typeof stored.acquiredAt !== 'number') {
    return null;
  }
  if (now - stored.acquiredAt > GEO_TTL_MS) {
    remove('session', KEYS.geo);
    return null;
  }
  return stored;
}

/** 現在地は sessionStorage にのみ置く。localStorage へは保存しない（REQ-001 §10）。 */
export function saveGeo(point: GeoPoint): void {
  write('session', KEYS.geo, point);
}

export function clearGeo(): void {
  remove('session', KEYS.geo);
}

export const STORAGE_KEYS = KEYS;
