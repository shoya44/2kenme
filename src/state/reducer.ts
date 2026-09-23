import { DEFAULT_CONDITION, type SearchSession } from '../services/storage';
import { shuffleInChunks } from '../utils/shuffle';
import type { RelaxLevel } from '../utils/relax';
import type { GeoPoint, SearchCondition, Shop } from '../types';

/** 候補を提示する順序を決めるブロック幅（FE-001 §19）。 */
export const SHUFFLE_CHUNK_SIZE = 10;

/** この件数以下になったら次ページを先読みする（FE-001 §19）。 */
export const PREFETCH_THRESHOLD = 8;

export type Screen = 'search' | 'result';

export type ErrorKind = 'location' | 'network';

export interface AppState {
  screen: Screen;
  condition: SearchCondition;
  relaxLevel: RelaxLevel;
  location: GeoPoint | null;
  currentShop: Shop | null;
  queue: Shop[];
  shownIds: string[];
  nextStart: number;
  hasMore: boolean;
  /** 検索中。「さがす」の多重押下を防ぐ */
  loading: boolean;
  /** 現在地の取得中 */
  locating: boolean;
  /** 先読み中。同時に1つまで */
  prefetching: boolean;
  /**
   * 先読みが失敗して止まっている。次のNG（ユーザー操作）まで再開しない。
   * これが無いと、失敗 → prefetching が戻る → 条件を満たす → 即再試行 の
   * ループになり、通信が切れている間に上流を叩き続ける
   */
  prefetchPaused: boolean;
  noCandidate: boolean;
  error: ErrorKind | null;
  /** セッションの開始時刻。TTL判定の基準。復元時は保存された値を引き継ぐ */
  startedAt: number | null;
}

export const initialState: AppState = {
  screen: 'search',
  condition: DEFAULT_CONDITION,
  relaxLevel: 0,
  location: null,
  currentShop: null,
  queue: [],
  shownIds: [],
  nextStart: 1,
  hasMore: false,
  loading: false,
  locating: false,
  prefetching: false,
  prefetchPaused: false,
  noCandidate: false,
  error: null,
  startedAt: null,
};

export type Action =
  | {
      type: 'restore';
      condition: SearchCondition;
      /** 復元に使うのは提示状態だけ。保存時刻は storage 側の関心事 */
      session: Omit<SearchSession, 'lastActiveAt'> | null;
    }
  | { type: 'setCondition'; condition: SearchCondition }
  | { type: 'locating' }
  | { type: 'locationAcquired'; location: GeoPoint }
  | {
      type: 'searchStarted';
      relaxLevel: RelaxLevel;
      startedAt: number;
      /** 表示済みIDを引き継ぐか。条件緩和は同じ抽選の続きなので引き継ぐ（FE-001 §15） */
      keepShown?: boolean;
    }
  | {
      type: 'searchSucceeded';
      shops: Shop[];
      nextStart: number;
      hasMore: boolean;
      /** 検索開始時の startedAt。古い応答を捨てるための世代 */
      startedAt: number;
    }
  | { type: 'ng' }
  | { type: 'prefetchStarted' }
  | {
      type: 'prefetchSucceeded';
      shops: Shop[];
      nextStart: number;
      hasMore: boolean;
      startedAt: number;
    }
  | {
      type: 'prefetchFailed';
      startedAt: number;
      /** 失敗の種類。手元に候補が無いときだけ画面に出す。省略時は通信失敗 */
      kind?: ErrorKind;
    }
  | { type: 'failed'; kind: ErrorKind }
  | { type: 'backToSearch' };

/** 表示済み・現在表示中・queue と重複する店舗を除外する（DATA-001 §9）。 */
export function mergeUniqueShops(state: AppState, incoming: readonly Shop[]): Shop[] {
  const seen = new Set<string>(state.shownIds);
  if (state.currentShop) {
    seen.add(state.currentShop.id);
  }
  for (const shop of state.queue) {
    seen.add(shop.id);
  }

  const unique: Shop[] = [];
  for (const shop of incoming) {
    if (seen.has(shop.id)) {
      continue;
    }
    seen.add(shop.id);
    unique.push(shop);
  }
  return unique;
}

/** 先読みすべきか（FE-001 §19）。 */
export function shouldPrefetch(state: AppState): boolean {
  return (
    state.queue.length <= PREFETCH_THRESHOLD &&
    state.hasMore &&
    !state.prefetching &&
    !state.prefetchPaused
  );
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'restore': {
      const { condition, session } = action;
      if (!session) {
        return { ...state, condition };
      }
      return {
        ...state,
        screen: session.currentShop ? 'result' : 'search',
        condition: session.condition,
        relaxLevel: session.relaxLevel,
        currentShop: session.currentShop,
        queue: session.queue,
        shownIds: session.shownIds,
        nextStart: session.nextStart,
        hasMore: session.hasMore,
        // 復元では開始時刻を引き継ぐ。ここで現在時刻にするとTTLが無限に延びる
        startedAt: session.startedAt,
      };
    }

    case 'setCondition':
      return { ...state, condition: action.condition };

    case 'locating':
      return { ...state, locating: true, error: null };

    case 'locationAcquired':
      return { ...state, location: action.location, locating: false };

    case 'searchStarted':
      // 再検索では前回の候補を捨てる。
      // 表示済みIDだけは、緩和・再試行なら引き継いでNG済みの店を再提示しない（F-06）
      return {
        ...state,
        relaxLevel: action.relaxLevel,
        startedAt: action.startedAt,
        loading: true,
        error: null,
        noCandidate: false,
        prefetchPaused: false,
        currentShop: null,
        queue: [],
        shownIds: action.keepShown ? state.shownIds : [],
        nextStart: 1,
        hasMore: false,
      };

    case 'searchSucceeded': {
      // 新しい検索が始まっていれば古い応答は捨てる
      if (action.startedAt !== state.startedAt) {
        return state;
      }
      const ordered = shuffleInChunks(mergeUniqueShops(state, action.shops), SHUFFLE_CHUNK_SIZE);
      const [first, ...rest] = ordered;

      if (!first) {
        // このページが空でも続きがあるなら候補なしにはしない。
        // 予算絞り込みや重複排除でページ単位に全滅することがあり、
        // そこで打ち切ると候補が残っているのに「候補なし」を出してしまう（FE-001 §14）
        return {
          ...state,
          loading: false,
          screen: 'result',
          nextStart: action.nextStart,
          hasMore: action.hasMore,
          noCandidate: !action.hasMore,
        };
      }

      return {
        ...state,
        loading: false,
        screen: 'result',
        currentShop: first,
        queue: rest,
        nextStart: action.nextStart,
        hasMore: action.hasMore,
        noCandidate: false,
      };
    }

    case 'ng': {
      if (!state.currentShop) {
        return state;
      }
      const shownIds = [...state.shownIds, state.currentShop.id];
      const [next, ...rest] = state.queue;
      // ユーザー操作を機に、止まっていた先読みを再開してよい
      const resumed = { ...state, shownIds, prefetchPaused: false };

      if (!next) {
        // 手元に候補がない。先読み中なら待ち、そうでなければ候補切れ
        return {
          ...resumed,
          currentShop: null,
          queue: [],
          noCandidate: !state.hasMore && !state.prefetching,
        };
      }

      return { ...resumed, currentShop: next, queue: rest };
    }

    case 'prefetchStarted':
      return { ...state, prefetching: true };

    case 'prefetchSucceeded': {
      if (action.startedAt !== state.startedAt) {
        return state;
      }
      const unique = mergeUniqueShops(state, action.shops);
      const ordered = shuffleInChunks(unique, SHUFFLE_CHUNK_SIZE);

      // NG連打でqueueが空のまま待っている場合は、先頭をそのまま表示へ回す
      if (!state.currentShop) {
        const [first, ...rest] = ordered;
        if (!first) {
          return {
            ...state,
            prefetching: false,
            nextStart: action.nextStart,
            hasMore: action.hasMore,
            noCandidate: !action.hasMore,
          };
        }
        return {
          ...state,
          prefetching: false,
          currentShop: first,
          queue: rest,
          nextStart: action.nextStart,
          hasMore: action.hasMore,
          noCandidate: false,
        };
      }

      return {
        ...state,
        prefetching: false,
        queue: [...state.queue, ...ordered],
        nextStart: action.nextStart,
        hasMore: action.hasMore,
      };
    }

    case 'prefetchFailed':
      if (action.startedAt !== state.startedAt) {
        return state;
      }
      // 既存候補があれば継続し、画面には出さない（BAS-001 §14）。
      // 次のNGまで自動では再試行しない（無限ループ防止）
      return {
        ...state,
        prefetching: false,
        prefetchPaused: true,
        ...(state.currentShop ? {} : { error: action.kind ?? 'network' }),
      };

    case 'failed':
      return { ...state, loading: false, locating: false, error: action.kind };

    case 'backToSearch':
      return { ...state, screen: 'search', error: null, noCandidate: false };

    default:
      return state;
  }
}

/**
 * 現在の状態から保存するセッションを作る（DATA-001 §7）。現在地は含めない。
 *
 * `lastActiveAt` は保存時に `saveSession` が打つ。
 */
export function toSession(
  state: AppState,
  startedAt = state.startedAt ?? 0,
): Omit<SearchSession, 'lastActiveAt'> {
  return {
    condition: state.condition,
    relaxLevel: state.relaxLevel,
    currentShop: state.currentShop,
    queue: state.queue,
    shownIds: state.shownIds,
    nextStart: state.nextStart,
    hasMore: state.hasMore,
    startedAt,
  };
}
