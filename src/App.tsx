import { useCallback, useEffect, useReducer, useState } from 'react';

import { AboutSheet } from './components/AboutSheet';
import { Header } from './components/Header';
import { HistorySheet } from './components/HistorySheet';
import { MenuSheet } from './components/MenuSheet';
import styles from './components/ui.module.css';
import { ResultScreen } from './screens/ResultScreen';
import { SearchScreen } from './screens/SearchScreen';
import { fetchShops } from './services/api';
import { getCurrentLocation } from './services/location';
import {
  addHistory,
  clearDefaults,
  clearHistory,
  clearSession,
  DEFAULT_CONDITION,
  loadDefaults,
  loadHistory,
  loadSession,
  saveDefaults,
  saveSession,
} from './services/storage';
import { initialState, reducer, shouldPrefetch, toSession, type AppState } from './state/reducer';
import { applyRelax, nextRelaxLevel, RELAX_LABELS, type RelaxLevel } from './utils/relax';
import type { HistoryEntry, SearchCondition } from './types';

type OpenSheet = 'none' | 'menu' | 'history' | 'about';

export function App() {
  // 起動時に前回条件とセッションを復元する。effect ではなく遅延初期化で行う
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    reducer(initialState, { type: 'restore', condition: loadDefaults(), session: loadSession() }),
  );
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [sheet, setSheet] = useState<OpenSheet>('none');

  // 状態が変わるたびにセッションを保存する（現在地は含めない）
  useEffect(() => {
    if (state.currentShop || state.shownIds.length > 0) {
      saveSession(toSession(state));
    }
  }, [state]);

  const runSearch = useCallback(
    async (condition: SearchCondition, relaxLevel: RelaxLevel, keepShown = false) => {
      const startedAt = Date.now();
      dispatch({ type: 'searchStarted', relaxLevel, startedAt, keepShown });
      saveDefaults(condition);
      clearSession();

      let location = state.location;
      if (!location) {
        dispatch({ type: 'locating' });
        try {
          location = await getCurrentLocation();
          dispatch({ type: 'locationAcquired', location });
        } catch {
          dispatch({ type: 'failed', kind: 'location' });
          return;
        }
      }

      try {
        const response = await fetchShops(applyRelax(condition, relaxLevel), location, 1);
        dispatch({
          type: 'searchSucceeded',
          shops: response.shops,
          nextStart: response.paging.nextStart,
          hasMore: response.paging.hasMore,
          startedAt,
        });
      } catch {
        dispatch({ type: 'failed', kind: 'network' });
      }
    },
    [state.location],
  );

  // 候補が少なくなったら次ページを先読みする
  useEffect(() => {
    if (state.screen !== 'result' || !shouldPrefetch(state)) {
      return;
    }

    const cached = state.location;
    const condition = applyRelax(state.condition, state.relaxLevel);
    const start = state.nextStart;
    const startedAt = state.startedAt ?? 0;

    dispatch({ type: 'prefetchStarted' });

    // 再レンダリングでは中断しない。中断すると prefetching が立ったまま
    // 戻らず、以降の先読みが止まる。古い応答は startedAt で捨てる
    void (async () => {
      let location = cached;
      if (!location) {
        // セッション復帰直後は現在地を持っていない。ここで取り直す（FE-001 §23）
        try {
          location = await getCurrentLocation();
          dispatch({ type: 'locationAcquired', location });
        } catch {
          dispatch({ type: 'prefetchFailed', startedAt });
          dispatch({ type: 'failed', kind: 'location' });
          return;
        }
      }

      try {
        const response = await fetchShops(condition, location, start);
        dispatch({
          type: 'prefetchSucceeded',
          shops: response.shops,
          nextStart: response.paging.nextStart,
          hasMore: response.paging.hasMore,
          startedAt,
        });
      } catch {
        dispatch({ type: 'prefetchFailed', startedAt });
      }
    })();
  }, [state]);

  const handleSearch = useCallback(() => {
    void runSearch(state.condition, 0);
  }, [runSearch, state.condition]);

  const handleRelax = useCallback(() => {
    const next = nextRelaxLevel(state.condition, state.relaxLevel);
    if (next === null) {
      return;
    }
    // 緩和は同じ抽選の続き。NG済みの店は再提示しない
    void runSearch(state.condition, next, true);
  }, [runSearch, state.condition, state.relaxLevel]);

  const handleRetry = useCallback(() => {
    void runSearch(state.condition, state.relaxLevel, true);
  }, [runSearch, state.condition, state.relaxLevel]);

  /** OKは a 要素のクリックと同期で実行する。preventDefault しない（FE-001 §13） */
  const handleOk = useCallback(() => {
    if (!state.currentShop) {
      return;
    }
    setHistory(addHistory(state.currentShop));
  }, [state.currentShop]);

  const actionLabel = state.locating ? '現在地を取得中…' : state.loading ? '検索中…' : 'さがす';
  const relaxNotice = state.relaxLevel === 0 ? null : RELAX_LABELS[state.relaxLevel].notice;
  // 画面に出す条件は、緩和を適用したあとの実際の検索条件
  const effectiveCondition = applyRelax(state.condition, state.relaxLevel);
  const nextLevel = nextRelaxLevel(state.condition, state.relaxLevel);
  const relaxCta = nextLevel === null ? null : RELAX_LABELS[nextLevel].cta;

  return (
    <div className={styles.app}>
      <Header
        onOpenMenu={() => setSheet('menu')}
        onGoHome={() => dispatch({ type: 'backToSearch' })}
      />

      {state.screen === 'search' ? (
        <SearchScreen
          condition={state.condition}
          onChange={(condition) => dispatch({ type: 'setCondition', condition })}
          onSearch={handleSearch}
          actionLabel={actionLabel}
          busy={state.loading || state.locating}
          error={state.error}
          onRetry={handleRetry}
        />
      ) : (
        <ResultScreen
          state={state}
          effectiveCondition={effectiveCondition}
          relaxNotice={relaxNotice}
          relaxCta={relaxCta}
          onNg={() => dispatch({ type: 'ng' })}
          onOk={handleOk}
          onRelax={handleRelax}
          onRetry={handleRetry}
          onBackToSearch={() => dispatch({ type: 'backToSearch' })}
        />
      )}

      {sheet === 'menu' && (
        <MenuSheet
          onClose={() => setSheet('none')}
          onOpenHistory={() => setSheet('history')}
          onResetCondition={() => {
            clearDefaults();
            dispatch({ type: 'setCondition', condition: DEFAULT_CONDITION });
            setSheet('none');
          }}
          onClearHistory={() => {
            clearHistory();
            setHistory([]);
            setSheet('none');
          }}
          onAbout={() => setSheet('about')}
        />
      )}

      {sheet === 'about' && <AboutSheet onClose={() => setSheet('none')} />}

      {sheet === 'history' && (
        <HistorySheet
          entries={history}
          onClose={() => setSheet('none')}
          onClear={() => {
            clearHistory();
            setHistory([]);
          }}
        />
      )}
    </div>
  );
}

export type { AppState };
