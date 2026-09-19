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
  noCandidate: false,
  error: null,
  startedAt: null,
};

export type Action =
  | { type: 'restore'; condition: SearchCondition; session: SearchSession | null }
  | { type: 'setCondition'; condition: SearchCondition }
  | { type: 'locating' }
  | { type: 'locationAcquired'; location: GeoPoint }
  | { type: 'searchStarted'; relaxLevel: RelaxLevel; startedAt: number }
  | { type: 'searchSucceeded'; shops: Shop[]; nextStart: number; hasMore: boolean }
  | { type: 'ng' }
  | { type: 'prefetchStarted' }
  | { type: 'prefetchSucceeded'; shops: Shop[]; nextStart: number; hasMore: boolean }
  | { type: 'prefetchFailed' }
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
  return state.queue.length <= PREFETCH_THRESHOLD && state.hasMore && !state.prefetching;
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
      // 再検索では前回セッションを捨てる
      return {
        ...state,
        relaxLevel: action.relaxLevel,
        startedAt: action.startedAt,
        loading: true,
        error: null,
        noCandidate: false,
        currentShop: null,
        queue: [],
        shownIds: [],
        nextStart: 1,
        hasMore: false,
      };

    case 'searchSucceeded': {
      const ordered = shuffleInChunks(action.shops, SHUFFLE_CHUNK_SIZE);
      const [first, ...rest] = ordered;

      if (!first) {
        return { ...state, loading: false, screen: 'result', noCandidate: true, hasMore: false };
      }

      return {
        ...state,
        loading: false,
        screen: 'result',
        currentShop: first,
        queue: rest,
        shownIds: [],
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

      if (!next) {
        // 手元に候補がない。先読み中なら待ち、そうでなければ候補切れ
        return {
          ...state,
          currentShop: null,
          queue: [],
          shownIds,
          noCandidate: !state.hasMore && !state.prefetching,
        };
      }

      return { ...state, currentShop: next, queue: rest, shownIds };
    }

    case 'prefetchStarted':
      return { ...state, prefetching: true };

    case 'prefetchSucceeded': {
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
      // 既存候補があれば継続する（BAS-001 §14）
      return {
        ...state,
        prefetching: false,
        ...(state.currentShop ? {} : { error: 'network' as const }),
      };

    case 'failed':
      return { ...state, loading: false, locating: false, error: action.kind };

    case 'backToSearch':
      return { ...state, screen: 'search', error: null, noCandidate: false };

    default:
      return state;
  }
}

/** 現在の状態から保存するセッションを作る（DATA-001 §7）。現在地は含めない。 */
export function toSession(state: AppState, startedAt = state.startedAt ?? 0): SearchSession {
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
