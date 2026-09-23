import { BUDGET_MAX_OPTIONS, GENRE_CODES } from '../../shared/api-types';
import type { RelaxLevel } from '../utils/relax';
import type { GeoPoint, HistoryEntry, SearchCondition, Shop } from '../types';

const KEYS = {
  defaults: 'tsugidoko:defaults',
  history: 'tsugidoko:history',
  session: 'tsugidoko:session',
  geo: 'tsugidoko:geo',
  geoGranted: 'tsugidoko:geo-granted',
  passcode: 'tsugidoko:passcode',
} as const;

/** セッションの有効期限。iOSのPWAは破棄されやすいためTTL付きlocalStorageに置く（DATA-001 §2）。 */
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * 離脱から復帰までの猶予。これを過ぎたらトップ画面から始める（DATA-001 §7）。
 *
 * 目的は「地図やメッセージを見て戻る」間だけ提示中の店を保つこと。
 * iOSのPWAはアプリを切り替えただけでも破棄されるため、それと
 * ユーザーが意図して開き直したのとは区別できない。経過時間で代える。
 */
export const RESUME_WINDOW_MS = 5 * 60 * 1000;

/**
 * 現在地の鮮度。これを過ぎたら取り直す（DATA-001 §6）。
 *
 * 1軒目から2軒目へ歩く用途なので、数百m動いたあとの検索で古い地点を
 * 使わない長さにする。同じ地点での連続検索は取得し直さない長さでもある。
 */
export const GEO_TTL_MS = 5 * 60 * 1000;

/** 履歴の保持件数（DATA-001 §11）。 */
export const HISTORY_LIMIT = 20;

export const DEFAULT_CONDITION: SearchCondition = {
  budgetMax: 4000,
  // 予算未登録というだけで候補から外すと極端に少なくなるため、既定で含める
  includeUnknownBudget: true,
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
  /** 最後に操作した、または画面を離れた時刻。復帰の可否を決める基準 */
  lastActiveAt: number;
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

/**
 * 保存された条件が今のアプリで使える値か。
 *
 * 旧バージョンが書いた選択肢外の値（廃止したジャンル等）をそのまま送ると
 * Worker が 400 を返し、「店舗を取得できませんでした」から抜け出せなくなる。
 * 許可値と照合し、外れていれば初期値へ戻す（DATA-001 §17）。
 */
function isValidCondition(value: unknown): value is SearchCondition {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const c = value as Partial<SearchCondition>;
  return (
    (c.budgetMax === null || (BUDGET_MAX_OPTIONS as readonly unknown[]).includes(c.budgetMax)) &&
    (c.includeUnknownBudget === undefined || typeof c.includeUnknownBudget === 'boolean') &&
    (c.genreCode === null || (GENRE_CODES as readonly unknown[]).includes(c.genreCode)) &&
    (c.range === 1 || c.range === 2 || c.range === 3 || c.range === 4) &&
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

  // lastActiveAt が無いのは旧バージョンが書いたセッション。開始時刻で代替する
  const lastActiveAt =
    typeof stored.lastActiveAt === 'number' ? stored.lastActiveAt : stored.startedAt;

  if (now - lastActiveAt > RESUME_WINDOW_MS || now - stored.startedAt > SESSION_TTL_MS) {
    clearSession();
    return null;
  }
  return stored;
}

/** 保存のたびに最終操作時刻を打ち直す。呼び出し側が意識しなくてよいようにする。 */
export function saveSession(session: Omit<SearchSession, 'lastActiveAt'>, now = Date.now()): void {
  write('local', KEYS.session, { ...session, lastActiveAt: now });
}

/**
 * 画面を離れた時刻を記録する（DATA-001 §7）。
 *
 * 結果画面を開いたまま放置して離脱した場合に、最後の「操作」ではなく
 * 「離れた時刻」を基準に復帰の可否を判断するため。
 */
export function touchSession(now = Date.now()): void {
  const stored = read<SearchSession>('local', KEYS.session);
  if (!stored) {
    return;
  }
  write('local', KEYS.session, { ...stored, lastActiveAt: now });
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

/* ---------------- passcode ---------------- */

/**
 * `/api/search` の合言葉（DATA-001 §12）。
 *
 * 毎回入力させないため localStorage に置く。端末に平文で残る共有秘密であり、
 * 秘密の強度は「その端末を使える人」までしか担保しない。
 */
export function loadPasscode(): string | null {
  const stored = read<unknown>('local', KEYS.passcode);
  return typeof stored === 'string' && stored.length > 0 ? stored : null;
}

export function savePasscode(passcode: string): void {
  write('local', KEYS.passcode, passcode);
}

export function clearPasscode(): void {
  remove('local', KEYS.passcode);
}

/* ---------------- geo permission ---------------- */

/**
 * 位置情報の取得に一度成功したことを覚える（DATA-001 §6）。
 *
 * 座標は残さない。「許可が済んでいる」という事実だけを残し、次回起動時に
 * 許可ダイアログを出さずに取得を先出しできるかの判断に使う。
 * Safari は Permissions API で geolocation を照会できないため、この実績で代える。
 */
export function markGeoGranted(): void {
  write('local', KEYS.geoGranted, true);
}

export function hasGeoGranted(): boolean {
  return read<unknown>('local', KEYS.geoGranted) === true;
}

export function clearGeoGranted(): void {
  remove('local', KEYS.geoGranted);
}

export const STORAGE_KEYS = KEYS;
