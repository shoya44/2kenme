import { DiscreteSlider } from '../components/DiscreteSlider';
import { ErrorNotice } from '../components/ErrorNotice';
import { GenreChips } from '../components/GenreChips';
import { HotpepperCredit } from '../components/HotpepperCredit';
import { PinIcon } from '../components/icons';
import { PreferenceAccordion } from '../components/PreferenceAccordion';
import styles from '../components/ui.module.css';
import { BUDGET_OPTIONS, RANGE_OPTIONS, rangeLabel } from '../constants';
import type { ErrorKind } from '../state/reducer';
import type { SearchCondition } from '../types';

interface Props {
  condition: SearchCondition;
  onChange: (condition: SearchCondition) => void;
  onSearch: () => void;
  /** ボタンの文言。通常 / 現在地を取得中… / 検索中… */
  actionLabel: string;
  busy: boolean;
  /** 位置情報・通信の失敗。トップ画面に留まるため、ここで見せる */
  error: ErrorKind | null;
  onRetry: () => void;
}

export function SearchScreen({
  condition,
  onChange,
  onSearch,
  actionLabel,
  busy,
  error,
  onRetry,
}: Props) {
  const budgetIndex = Math.max(
    0,
    BUDGET_OPTIONS.findIndex((o) => o.max === condition.budgetMax),
  );
  const rangeIndex = Math.max(
    0,
    RANGE_OPTIONS.findIndex((o) => o.value === condition.range),
  );

  return (
    <div className={styles.body}>
      <DiscreteSlider
        label="予算"
        index={budgetIndex}
        options={BUDGET_OPTIONS}
        ticks="ends"
        onChange={(i) => onChange({ ...condition, budgetMax: BUDGET_OPTIONS[i]?.max ?? null })}
      />

      <GenreChips
        value={condition.genreCode}
        onChange={(genreCode) => onChange({ ...condition, genreCode })}
      />

      <PreferenceAccordion
        value={condition.preferences}
        onChange={(preferences) => onChange({ ...condition, preferences })}
      />

      <DiscreteSlider
        label="距離"
        index={rangeIndex}
        options={RANGE_OPTIONS}
        onChange={(i) => onChange({ ...condition, range: RANGE_OPTIONS[i]?.value ?? 3 })}
      />

      {error && <ErrorNotice kind={error} onRetry={onRetry} />}

      {/* 検索前に探索の中心を示す（FE-001 §22） */}
      <p className={styles.scopeCta} style={{ marginTop: 'auto' }}>
        <PinIcon size={14} />
        現在地から半径{rangeLabel(condition.range)}以内でさがします
      </p>

      <div className={styles.ctaWrap} style={{ marginTop: 0 }}>
        <button type="button" className={styles.cta} onClick={onSearch} disabled={busy}>
          {actionLabel}
        </button>
      </div>

      <HotpepperCredit />
    </div>
  );
}
