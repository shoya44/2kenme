import { ErrorNotice } from '../components/ErrorNotice';
import { HotpepperCredit } from '../components/HotpepperCredit';
import { NoCandidate } from '../components/NoCandidate';
import { ResultSkeleton } from '../components/ResultSkeleton';
import { ShopResult } from '../components/ShopResult';
import styles from '../components/ui.module.css';
import type { AppState } from '../state/reducer';
import type { SearchCondition } from '../types';

interface Props {
  state: AppState;
  /** 実際に検索に使った条件（緩和を適用したあと） */
  effectiveCondition: SearchCondition;
  relaxNotice: string | null;
  relaxCta: string | null;
  onNg: () => void;
  onOk: () => void;
  onRelax: () => void;
  onRetry: () => void;
  onBackToSearch: () => void;
}

export function ResultScreen({
  state,
  effectiveCondition,
  relaxNotice,
  relaxCta,
  onNg,
  onOk,
  onRelax,
  onRetry,
  onBackToSearch,
}: Props) {
  return (
    <div className={styles.body}>
      {state.error ? (
        <ErrorNotice kind={state.error} onRetry={onRetry} />
      ) : state.noCandidate ? (
        <NoCandidate condition={effectiveCondition} relaxCta={relaxCta} onRelax={onRelax} />
      ) : state.currentShop ? (
        <ShopResult
          shop={state.currentShop}
          condition={effectiveCondition}
          relaxNotice={relaxNotice}
          onNg={onNg}
          onOk={onOk}
          disabled={state.loading}
        />
      ) : (
        <ResultSkeleton />
      )}

      <button type="button" className={styles.textLink} onClick={onBackToSearch}>
        条件を変更
      </button>

      <div className={styles.pushDown}>
        <HotpepperCredit />
      </div>
    </div>
  );
}
