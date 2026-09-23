import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addHistory,
  clearHistory,
  clearSession,
  DEFAULT_CONDITION,
  clearGeoGranted,
  clearPasscode,
  GEO_TTL_MS,
  hasGeoGranted,
  loadPasscode,
  markGeoGranted,
  savePasscode,
  touchSession,
  HISTORY_LIMIT,
  loadDefaults,
  loadGeo,
  loadHistory,
  loadSession,
  saveDefaults,
  saveGeo,
  saveSession,
  RESUME_WINDOW_MS,
  SESSION_TTL_MS,
  STORAGE_KEYS,
  type SearchSession,
} from './storage';
import type { SearchCondition, Shop } from '../types';

const condition: SearchCondition = {
  budgetMax: 3000,
  includeUnknownBudget: true,
  genreCode: 'G012',
  preferences: { privateRoom: true, freeDrink: false, midnight: true },
  range: 2,
};

const shop = (overrides: Partial<Shop> = {}): Shop => ({
  id: 'J001',
  name: 'BAR K',
  photoUrl: 'https://example.com/a.jpg',
  hotpepperUrl: 'https://www.hotpepper.jp/strJ001/',
  budgetText: '3001～4000円',
  walkMinutes: 4,
  openText: '17:00～翌2:00',
  closedText: '日曜日',
  ...overrides,
});

const session = (overrides: Partial<SearchSession> = {}): SearchSession => ({
  condition,
  relaxLevel: 0,
  currentShop: shop(),
  queue: [],
  shownIds: [],
  lastActiveAt: 1_700_000_000_000,
  nextStart: 51,
  hasMore: true,
  startedAt: Date.now(),
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** 前回条件（DATA-001 §4 / TEST-001 §5）。 */
describe('defaults', () => {
  it('未保存なら既定値を返す', () => {
    expect(loadDefaults()).toEqual(DEFAULT_CONDITION);
  });

  it('保存した条件を復元する', () => {
    saveDefaults(condition);

    expect(loadDefaults()).toEqual(condition);
  });

  it('壊れたJSONなら既定値を返し、キーを削除する', () => {
    localStorage.setItem(STORAGE_KEYS.defaults, '{壊れた');

    expect(loadDefaults()).toEqual(DEFAULT_CONDITION);
    expect(localStorage.getItem(STORAGE_KEYS.defaults)).toBeNull();
  });

  it('形が不正なら既定値を返す', () => {
    localStorage.setItem(STORAGE_KEYS.defaults, JSON.stringify({ range: 99 }));

    expect(loadDefaults()).toEqual(DEFAULT_CONDITION);
  });

  it('項目が欠けていても既定値で補う', () => {
    localStorage.setItem(
      STORAGE_KEYS.defaults,
      JSON.stringify({ budgetMax: 2000, genreCode: null, range: 1, preferences: {} }),
    );

    const result = loadDefaults();

    expect(result.budgetMax).toBe(2000);
    expect(result.preferences).toEqual(DEFAULT_CONDITION.preferences);
  });
});

/** 履歴（DATA-001 §11）。 */
describe('history', () => {
  it('未保存なら空配列', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('OKした店舗を先頭へ積む', () => {
    addHistory(shop({ id: 'a' }));
    addHistory(shop({ id: 'b' }));

    expect(loadHistory().map((e) => e.shopId)).toEqual(['b', 'a']);
  });

  it('店舗写真を保存しない', () => {
    addHistory(shop());

    expect(loadHistory()[0]).not.toHaveProperty('photoUrl');
    expect(localStorage.getItem(STORAGE_KEYS.history)).not.toContain('example.com');
  });

  it('上限を超えると最古が消える', () => {
    for (let i = 0; i < HISTORY_LIMIT + 3; i++) {
      addHistory(shop({ id: `s${i}` }));
    }
    const history = loadHistory();

    expect(history).toHaveLength(HISTORY_LIMIT);
    expect(history.at(-1)?.shopId).toBe('s3');
  });

  it('同一店舗を再度OKすると1件だけ残り先頭へ来る', () => {
    addHistory(shop({ id: 'a' }));
    addHistory(shop({ id: 'b' }));
    addHistory(shop({ id: 'a' }));
    const history = loadHistory();

    expect(history.map((e) => e.shopId)).toEqual(['a', 'b']);
  });

  it('決定時刻を記録する', () => {
    addHistory(shop(), 1_700_000_000_000);

    expect(loadHistory()[0]?.decidedAt).toBe(1_700_000_000_000);
  });

  it('消去できる', () => {
    addHistory(shop());
    clearHistory();

    expect(loadHistory()).toEqual([]);
  });

  it('壊れた値は空配列として扱う', () => {
    localStorage.setItem(STORAGE_KEYS.history, '[[[');

    expect(loadHistory()).toEqual([]);
  });

  it('配列でない値は空配列として扱う', () => {
    localStorage.setItem(STORAGE_KEYS.history, '{"a":1}');

    expect(loadHistory()).toEqual([]);
  });
});

/** セッション（DATA-001 §7）。 */
describe('session', () => {
  it('未保存ならnull', () => {
    expect(loadSession()).toBeNull();
  });

  it('離脱から猶予内なら復元する', () => {
    const now = 1_700_000_000_000;
    saveSession(session({ startedAt: now }), now);

    expect(loadSession(now + RESUME_WINDOW_MS)?.nextStart).toBe(51);
  });

  it('離脱から猶予を超えたら破棄してnullを返す（立ち上げ直しはトップ画面）', () => {
    const now = 1_700_000_000_000;
    saveSession(session({ startedAt: now }), now);

    expect(loadSession(now + RESUME_WINDOW_MS + 1)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
  });

  it('操作を続けていても、検索開始からTTLを超えたら破棄する', () => {
    const now = 1_700_000_000_000;
    const late = now + SESSION_TTL_MS + 1;
    // 直前まで操作していた（lastActiveAt は新しい）が、検索開始は2時間以上前
    saveSession(session({ startedAt: now }), late);

    expect(loadSession(late)).toBeNull();
  });

  it('保存のたびに最終操作時刻を打ち直す', () => {
    const now = 1_700_000_000_000;
    saveSession(session({ startedAt: now }), now);

    saveSession(session({ startedAt: now }), now + RESUME_WINDOW_MS);

    // 打ち直した時刻が基準になる
    expect(loadSession(now + RESUME_WINDOW_MS * 2)?.nextStart).toBe(51);
  });

  it('離脱時刻を記録できる', () => {
    const now = 1_700_000_000_000;
    saveSession(session({ startedAt: now }), now);

    touchSession(now + RESUME_WINDOW_MS);

    expect(loadSession(now + RESUME_WINDOW_MS * 2)?.nextStart).toBe(51);
  });

  it('セッションが無ければ離脱時刻の記録は何もしない', () => {
    touchSession();

    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull();
  });

  it('lastActiveAt が無い旧データは開始時刻で判断する', () => {
    const now = 1_700_000_000_000;
    const legacy: Record<string, unknown> = { ...session({ startedAt: now }) };
    delete legacy.lastActiveAt;
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(legacy));

    expect(loadSession(now + RESUME_WINDOW_MS)?.nextStart).toBe(51);
    expect(loadSession(now + RESUME_WINDOW_MS + 1)).toBeNull();
  });

  it('現在地を含めない', () => {
    saveSession(session());

    const raw = localStorage.getItem(STORAGE_KEYS.session) ?? '';

    expect(raw).not.toContain('lat');
    expect(raw).not.toContain('lng');
  });

  it('消去できる', () => {
    saveSession(session());
    clearSession();

    expect(loadSession()).toBeNull();
  });

  it('壊れた値はnull', () => {
    localStorage.setItem(STORAGE_KEYS.session, 'x');

    expect(loadSession()).toBeNull();
  });
});

/** 現在地（DATA-001 §6）。 */
describe('geo', () => {
  const point = { lat: 35.69, lng: 139.7, acquiredAt: 1_700_000_000_000 };

  it('sessionStorage に保存し、localStorage には書かない', () => {
    saveGeo(point);

    expect(sessionStorage.getItem(STORAGE_KEYS.geo)).toContain('35.69');
    expect(localStorage.getItem(STORAGE_KEYS.geo)).toBeNull();
  });

  it('鮮度内なら返す', () => {
    saveGeo(point);

    expect(loadGeo(point.acquiredAt + GEO_TTL_MS - 1)).toEqual(point);
  });

  it('鮮度を過ぎたら破棄してnullを返す', () => {
    saveGeo(point);

    expect(loadGeo(point.acquiredAt + GEO_TTL_MS + 1)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.geo)).toBeNull();
  });

  it('鮮度は5分', () => {
    expect(GEO_TTL_MS).toBe(5 * 60 * 1000);
  });
});

/** 合言葉（DATA-001 §12）。 */
describe('passcode', () => {
  it('保存して読み出せる', () => {
    savePasscode('secret-value');

    expect(loadPasscode()).toBe('secret-value');
  });

  it('未保存ならnull', () => {
    expect(loadPasscode()).toBeNull();
  });

  it('空文字はnullとして扱う', () => {
    savePasscode('');

    expect(loadPasscode()).toBeNull();
  });

  it('消すとnullに戻る', () => {
    savePasscode('secret-value');

    clearPasscode();

    expect(loadPasscode()).toBeNull();
  });

  it('文字列以外が入っていてもnull', () => {
    localStorage.setItem(STORAGE_KEYS.passcode, '123');

    expect(loadPasscode()).toBeNull();
  });
});

/** 位置情報の許可実績（DATA-001 §6）。 */
describe('geo-granted', () => {
  it('既定では実績なし', () => {
    expect(hasGeoGranted()).toBe(false);
  });

  it('記録すると残り、消すと戻る', () => {
    markGeoGranted();
    expect(hasGeoGranted()).toBe(true);

    clearGeoGranted();
    expect(hasGeoGranted()).toBe(false);
  });

  it('座標は残さない', () => {
    markGeoGranted();

    expect(localStorage.getItem(STORAGE_KEYS.geoGranted)).toBe('true');
    expect(localStorage.getItem(STORAGE_KEYS.geo)).toBeNull();
  });
});

/** 異常系（DATA-001 §13）。 */
describe('Web Storage が使えない環境', () => {
  it('QuotaExceededError を握りつぶして継続する', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(() => saveDefaults(condition)).not.toThrow();
    expect(() => addHistory(shop())).not.toThrow();
    expect(() => saveSession(session())).not.toThrow();
  });

  it('getItem が例外を投げても初期値で継続する', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(loadDefaults()).toEqual(DEFAULT_CONDITION);
    expect(loadHistory()).toEqual([]);
    expect(loadSession()).toBeNull();
    expect(loadGeo()).toBeNull();
  });
});

describe('キーの前置詞', () => {
  it('tsugidoko: 以外のキーへ書き込まない', () => {
    saveDefaults(condition);
    addHistory(shop());
    saveSession(session());
    saveGeo({ lat: 1, lng: 2, acquiredAt: Date.now() });

    const keys = [...Object.keys(localStorage), ...Object.keys(sessionStorage)];

    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key.startsWith('tsugidoko:')).toBe(true);
    }
  });
});
