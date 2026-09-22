import { describe, expect, it } from 'vitest';

import {
  initialState,
  mergeUniqueShops,
  PREFETCH_THRESHOLD,
  reducer,
  shouldPrefetch,
  toSession,
  type Action,
  type AppState,
} from './reducer';
import type { Shop } from '../types';

const shop = (id: string): Shop => ({
  id,
  name: `店 ${id}`,
  photoUrl: null,
  hotpepperUrl: `https://www.hotpepper.jp/str${id}/`,
  budgetText: '3001～4000円',
  walkMinutes: 4,
});

const shops = (n: number, prefix = 's') =>
  Array.from({ length: n }, (_, i) => shop(`${prefix}${i}`));

const run = (state: AppState, ...actions: Action[]) => actions.reduce(reducer, state);

const searched = (count = 20, hasMore = true) =>
  run(
    initialState,
    { type: 'searchStarted', relaxLevel: 0, startedAt: 1 },
    {
      type: 'searchSucceeded',
      shops: shops(count),
      nextStart: 51,
      hasMore,
      startedAt: 1,
    },
  );

/** 提示制御（FE-001 §12, §19 / TEST-001 §5）。 */
describe('検索', () => {
  it('成功すると結果画面へ移り、1店舗だけ表示する', () => {
    const state = searched();

    expect(state.screen).toBe('result');
    expect(state.currentShop).not.toBeNull();
    expect(state.queue).toHaveLength(19);
    expect(state.loading).toBe(false);
  });

  it('0件なら候補なしになる', () => {
    const state = run(
      initialState,
      { type: 'searchStarted', relaxLevel: 0, startedAt: 1 },
      {
        type: 'searchSucceeded',
        shops: [],
        nextStart: 1,
        hasMore: false,
        startedAt: 1,
      },
    );

    expect(state.noCandidate).toBe(true);
    expect(state.currentShop).toBeNull();
    expect(state.screen).toBe('result');
  });

  it('検索開始で前回の状態を捨てる', () => {
    const state = run(searched(), { type: 'searchStarted', relaxLevel: 2, startedAt: 2 });

    expect(state.currentShop).toBeNull();
    expect(state.queue).toEqual([]);
    expect(state.shownIds).toEqual([]);
    expect(state.relaxLevel).toBe(2);
    expect(state.loading).toBe(true);
  });

  it('提示される店舗は取得した集合に含まれる', () => {
    const state = searched();
    const ids = shops(20).map((s) => s.id);

    expect(ids).toContain(state.currentShop?.id);
  });
});

describe('NG', () => {
  it('別の店舗が表示される', () => {
    const before = searched();

    const after = reducer(before, { type: 'ng' });

    expect(after.currentShop?.id).not.toBe(before.currentShop?.id);
    expect(after.queue).toHaveLength(18);
  });

  it('表示済みへ積まれる', () => {
    const before = searched();

    const after = reducer(before, { type: 'ng' });

    expect(after.shownIds).toEqual([before.currentShop?.id]);
  });

  it('同じ店舗が2度表示されない', () => {
    let state = searched();
    const seen: string[] = [];

    for (let i = 0; i < 20; i++) {
      if (state.currentShop) {
        seen.push(state.currentShop.id);
      }
      state = reducer(state, { type: 'ng' });
    }

    expect(new Set(seen).size).toBe(seen.length);
  });

  it('候補が尽き、追加取得もできなければ候補なしになる', () => {
    let state = searched(2, false);

    state = reducer(state, { type: 'ng' });
    state = reducer(state, { type: 'ng' });

    expect(state.currentShop).toBeNull();
    expect(state.noCandidate).toBe(true);
  });

  it('先読み中に候補が尽きても候補なしにはしない（待つ）', () => {
    let state = searched(1, true);
    state = reducer(state, { type: 'prefetchStarted' });

    state = reducer(state, { type: 'ng' });

    expect(state.currentShop).toBeNull();
    expect(state.noCandidate).toBe(false);
  });

  it('現在店舗が無い状態のNGは何もしない', () => {
    const state = { ...initialState, currentShop: null };

    expect(reducer(state, { type: 'ng' })).toBe(state);
  });
});

describe('先読み', () => {
  it('残りが閾値以下かつ続きがあれば発火する', () => {
    const state = { ...searched(), queue: shops(PREFETCH_THRESHOLD), hasMore: true };

    expect(shouldPrefetch(state)).toBe(true);
  });

  it('閾値より多ければ発火しない', () => {
    const state = { ...searched(), queue: shops(PREFETCH_THRESHOLD + 1), hasMore: true };

    expect(shouldPrefetch(state)).toBe(false);
  });

  it('続きが無ければ発火しない', () => {
    const state = { ...searched(), queue: [], hasMore: false };

    expect(shouldPrefetch(state)).toBe(false);
  });

  it('先読み中は二重に発火しない', () => {
    const state = { ...searched(), queue: [], hasMore: true, prefetching: true };

    expect(shouldPrefetch(state)).toBe(false);
  });

  it('取得した候補をqueue末尾へ足す', () => {
    const before = { ...searched(10), prefetching: true };

    const after = reducer(before, {
      type: 'prefetchSucceeded',
      shops: shops(5, 't'),
      nextStart: 101,
      hasMore: true,
      startedAt: 1,
    });

    expect(after.queue).toHaveLength(before.queue.length + 5);
    expect(after.prefetching).toBe(false);
    expect(after.nextStart).toBe(101);
  });

  it('待機中（現在店舗なし）なら先頭を表示へ回す', () => {
    let state = searched(1, true);
    state = reducer(state, { type: 'prefetchStarted' });
    state = reducer(state, { type: 'ng' });

    const after = reducer(state, {
      type: 'prefetchSucceeded',
      shops: shops(3, 't'),
      nextStart: 101,
      hasMore: false,
      startedAt: 1,
    });

    expect(after.currentShop).not.toBeNull();
    expect(after.queue).toHaveLength(2);
    expect(after.noCandidate).toBe(false);
  });

  it('待機中に0件が返り、続きも無ければ候補なし', () => {
    let state = searched(1, true);
    state = reducer(state, { type: 'prefetchStarted' });
    state = reducer(state, { type: 'ng' });

    const after = reducer(state, {
      type: 'prefetchSucceeded',
      shops: [],
      nextStart: 101,
      hasMore: false,
      startedAt: 1,
    });

    expect(after.noCandidate).toBe(true);
  });

  it('失敗しても既存候補があれば継続する', () => {
    const before = { ...searched(10), prefetching: true };

    const after = reducer(before, { type: 'prefetchFailed', startedAt: 1 });

    expect(after.error).toBeNull();
    expect(after.currentShop).not.toBeNull();
  });

  it('失敗して手元に候補が無ければエラーにする', () => {
    let state = searched(1, true);
    state = reducer(state, { type: 'prefetchStarted' });
    state = reducer(state, { type: 'ng' });

    const after = reducer(state, { type: 'prefetchFailed', startedAt: 1 });

    expect(after.error).toBe('network');
  });
});

describe('mergeUniqueShops', () => {
  const base = (): AppState => ({
    ...initialState,
    currentShop: shop('cur'),
    queue: [shop('q1'), shop('q2')],
    shownIds: ['old1', 'old2'],
  });

  it('表示済み・現在店舗・queue と重複する店舗を除外する', () => {
    const incoming = [shop('old1'), shop('cur'), shop('q1'), shop('new')];

    expect(mergeUniqueShops(base(), incoming).map((s) => s.id)).toEqual(['new']);
  });

  it('重複が無ければ全件通す', () => {
    const incoming = shops(3, 'n');

    expect(mergeUniqueShops(base(), incoming)).toHaveLength(3);
  });

  it('取得結果の中の重複も1件に畳む', () => {
    const incoming = [shop('a'), shop('a'), shop('b')];

    expect(mergeUniqueShops(base(), incoming).map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('復元', () => {
  it('セッションが無ければ条件だけ復元する', () => {
    const condition = { ...initialState.condition, range: 1 as const };

    const state = reducer(initialState, { type: 'restore', condition, session: null });

    expect(state.condition.range).toBe(1);
    expect(state.screen).toBe('search');
  });

  it('セッションがあれば結果画面から再開する', () => {
    const source = searched();
    const session = toSession(source, Date.now());

    const state = reducer(initialState, {
      type: 'restore',
      condition: initialState.condition,
      session,
    });

    expect(state.screen).toBe('result');
    expect(state.currentShop?.id).toBe(source.currentShop?.id);
    expect(state.queue).toHaveLength(source.queue.length);
  });

  it('保存するセッションに現在地を含めない', () => {
    const source = { ...searched(), location: { lat: 35.6, lng: 139.7, acquiredAt: 1 } };

    const session = toSession(source, Date.now());

    expect(JSON.stringify(session)).not.toContain('139.7');
  });
});

describe('エラーと画面遷移', () => {
  it('位置情報の失敗を記録する', () => {
    const state = reducer(initialState, { type: 'failed', kind: 'location' });

    expect(state.error).toBe('location');
    expect(state.loading).toBe(false);
  });

  it('条件変更で検索画面へ戻り、エラーを消す', () => {
    const state = run(searched(), { type: 'failed', kind: 'network' }, { type: 'backToSearch' });

    expect(state.screen).toBe('search');
    expect(state.error).toBeNull();
    expect(state.noCandidate).toBe(false);
  });

  it('条件変更しても現在の条件を保つ', () => {
    const condition = { ...initialState.condition, budgetMax: 7000 as const };
    const state = run(initialState, { type: 'setCondition', condition }, { type: 'backToSearch' });

    expect(state.condition.budgetMax).toBe(7000);
  });
});

describe('セッションのTTL基準', () => {
  it('検索開始で開始時刻を記録する', () => {
    const state = reducer(initialState, {
      type: 'searchStarted',
      relaxLevel: 0,
      startedAt: 12_345,
    });

    expect(state.startedAt).toBe(12_345);
  });

  it('復元では保存された開始時刻を引き継ぐ（TTLが延びない）', () => {
    const source = { ...searched(), startedAt: 1_000 };
    const session = toSession(source);

    const restored = reducer(initialState, {
      type: 'restore',
      condition: initialState.condition,
      session,
    });

    expect(session.startedAt).toBe(1_000);
    expect(restored.startedAt).toBe(1_000);
  });
});

/** 応答の世代管理（古い応答の取り違え防止）。 */
describe('世代の取り違え防止', () => {
  it('古い検索の応答は捨てる', () => {
    const state = run(initialState, { type: 'searchStarted', relaxLevel: 0, startedAt: 2 });

    const after = reducer(state, {
      type: 'searchSucceeded',
      shops: shops(5),
      nextStart: 51,
      hasMore: true,
      startedAt: 1,
    });

    expect(after).toBe(state);
    expect(after.currentShop).toBeNull();
  });

  it('古い先読みの応答は捨てる', () => {
    const state = { ...searched(), prefetching: true };

    const after = reducer(state, {
      type: 'prefetchSucceeded',
      shops: shops(5, 't'),
      nextStart: 101,
      hasMore: true,
      startedAt: 999,
    });

    expect(after).toBe(state);
  });

  it('古い先読みの失敗は状態を変えない', () => {
    const state = { ...searched(), prefetching: true };

    expect(reducer(state, { type: 'prefetchFailed', startedAt: 999 })).toBe(state);
  });

  it('同世代の先読み失敗は prefetching を戻す', () => {
    const state = { ...searched(), prefetching: true };

    expect(reducer(state, { type: 'prefetchFailed', startedAt: 1 }).prefetching).toBe(false);
  });
});

/** ページ単位の全滅と、NGの持ち越し（FE-001 §14, §15 / TEST-001 §5）。 */
describe('候補の取り切り', () => {
  const emptyPage = (hasMore: boolean) =>
    run(
      initialState,
      { type: 'searchStarted', relaxLevel: 0, startedAt: 1 },
      { type: 'searchSucceeded', shops: [], nextStart: 51, hasMore, startedAt: 1 },
    );

  it('0件でも続きがあれば候補なしにせず、次ページの位置を保つ', () => {
    const state = emptyPage(true);

    expect(state.noCandidate).toBe(false);
    expect(state.nextStart).toBe(51);
    expect(state.hasMore).toBe(true);
    expect(shouldPrefetch(state)).toBe(true);
  });

  it('0件で続きも無ければ候補なしになる', () => {
    expect(emptyPage(false).noCandidate).toBe(true);
  });

  it('緩和での再検索は、NGした店を引き継いで再提示しない', () => {
    let state = searched(2);
    const ngId = state.currentShop?.id;
    state = reducer(state, { type: 'ng' });

    state = run(
      state,
      { type: 'searchStarted', relaxLevel: 1, startedAt: 2, keepShown: true },
      { type: 'searchSucceeded', shops: shops(2), nextStart: 51, hasMore: false, startedAt: 2 },
    );

    expect(state.shownIds).toContain(ngId);
    expect(state.currentShop?.id).not.toBe(ngId);
    expect(state.queue.map((s) => s.id)).not.toContain(ngId);
  });

  it('トップからの検索では表示済みを捨てる', () => {
    let state = searched(2);
    state = reducer(state, { type: 'ng' });

    state = reducer(state, { type: 'searchStarted', relaxLevel: 0, startedAt: 2 });

    expect(state.shownIds).toEqual([]);
  });
});
