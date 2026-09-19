import { ErrorNotice } from '../components/ErrorNotice';
import { HotpepperCredit } from '../components/HotpepperCredit';
import { NoCandidate } from '../components/NoCandidate';
import { ResultSkeleton } from '../components/ResultSkeleton';
import { ShopResult } from '../components/ShopResult';
import styles from '../components/ui.module.css';
import type { AppState } from '../state/reducer';

interface Props {
  state: AppState;
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
        <NoCandidate relaxCta={relaxCta} onRelax={onRelax} />
      ) : state.currentShop ? (
        <ShopResult
          shop={state.currentShop}
          range={state.condition.range}
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

      <div style={{ marginTop: 'auto' }}>
        <HotpepperCredit />
      </div>
    </div>
  );
}
