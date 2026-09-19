import { BUDGET_OPTIONS } from '../constants';
import { DiscreteSlider } from './DiscreteSlider';
import styles from './ui.module.css';
import type { BudgetMax } from '../types';

interface Props {
  budgetMax: BudgetMax;
  includeUnknownBudget: boolean;
  onChangeBudget: (max: BudgetMax) => void;
  onChangeInclude: (include: boolean) => void;
}

/**
 * 予算の上限指定と、未登録店舗の扱い。
 *
 * HotPepperの予算絞り込みは店舗が登録した予算帯との一致で行うため、
 * 未登録の店舗は一律に除外される。含めるかを選べるようにする。
 */
export function BudgetSection({
  budgetMax,
  includeUnknownBudget,
  onChangeBudget,
  onChangeInclude,
}: Props) {
  const index = Math.max(
    0,
    BUDGET_OPTIONS.findIndex((o) => o.max === budgetMax),
  );

  // 上限を指定していなければ、未登録を含めるかどうかは意味を持たない
  const disabled = budgetMax === null;

  return (
    <DiscreteSlider
      label="予算"
      index={index}
      options={BUDGET_OPTIONS}
      ticks="ends"
      onChange={(i) => onChangeBudget(BUDGET_OPTIONS[i]?.max ?? null)}
    >
      <label className={styles.budgetOption} data-disabled={disabled}>
        <input
          type="checkbox"
          checked={includeUnknownBudget}
          disabled={disabled}
          onChange={(e) => onChangeInclude(e.currentTarget.checked)}
        />
        予算未登録の店も含める
      </label>

      {!disabled && (
        <p className={styles.budgetNote}>
          {includeUnknownBudget
            ? '予算を登録していない店も候補に入ります。候補は増えますが、予算が合わないこともあります。'
            : '予算を登録している店だけに絞ります。候補はかなり少なくなります。'}
        </p>
      )}
    </DiscreteSlider>
  );
}
