import { BudgetSection } from '../components/BudgetSection';
import { DiscreteSlider } from '../components/DiscreteSlider';
import { ErrorNotice } from '../components/ErrorNotice';
import { GenreChips } from '../components/GenreChips';
import { HotpepperCredit } from '../components/HotpepperCredit';
import { PinIcon } from '../components/icons';
import { PreferenceAccordion } from '../components/PreferenceAccordion';
import styles from '../components/ui.module.css';
import { RANGE_OPTIONS, rangeLabel } from '../constants';
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
  /** 深夜帯。「23時以降営業」を既定でONにしたことを知らせる */
  lateNight: boolean;
}

export function SearchScreen({
  condition,
  onChange,
  onSearch,
  actionLabel,
  busy,
  error,
  onRetry,
  lateNight,
}: Props) {
  const rangeIndex = Math.max(
    0,
    RANGE_OPTIONS.findIndex((o) => o.value === condition.range),
  );

  return (
    <div className={styles.body}>
      <BudgetSection
        budgetMax={condition.budgetMax}
        includeUnknownBudget={condition.includeUnknownBudget}
        onChangeBudget={(budgetMax) => onChange({ ...condition, budgetMax })}
        onChangeInclude={(includeUnknownBudget) => onChange({ ...condition, includeUnknownBudget })}
      />

      <GenreChips
        value={condition.genreCode}
        onChange={(genreCode) => onChange({ ...condition, genreCode })}
      />

      <PreferenceAccordion
        value={condition.preferences}
        onChange={(preferences) => onChange({ ...condition, preferences })}
      />

      {/* 自動でONにした条件は黙って適用せず、外せることも示す（FE-001 §7） */}
      {lateNight && condition.preferences.midnight && (
        <p className={styles.lateNightNote}>
          深夜帯のため「23時以降営業」をONにしています。外すこともできます。
        </p>
      )}

      <DiscreteSlider
        label="距離"
        index={rangeIndex}
        options={RANGE_OPTIONS}
        onChange={(i) => onChange({ ...condition, range: RANGE_OPTIONS[i]?.value ?? 3 })}
      />

      {error && <ErrorNotice kind={error} onRetry={onRetry} />}

      {/* 検索前に探索の中心を示す（FE-001 §22） */}
      <p className={`${styles.scopeCta} ${styles.pushDown}`}>
        <PinIcon size={14} />
        現在地から半径{rangeLabel(condition.range)}以内でさがします
      </p>

      <div className={styles.ctaWrap}>
        <button type="button" className={styles.cta} onClick={onSearch} disabled={busy}>
          {actionLabel}
        </button>
      </div>

      <HotpepperCredit />
    </div>
  );
}
