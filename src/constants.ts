import type { BudgetMax, GenreCode, RangeCode, SearchCondition } from './types';

/** 予算は上限指定（REQ-001 §6.1 / FE-001 §5）。 */
export interface BudgetOption {
  max: BudgetMax;
  label: string;
}

export const BUDGET_OPTIONS: readonly BudgetOption[] = [
  { max: 2000, label: '2,000円以内' },
  { max: 3000, label: '3,000円以内' },
  { max: 4000, label: '4,000円以内' },
  { max: 5000, label: '5,000円以内' },
  { max: 7000, label: '7,000円以内' },
  { max: 10000, label: '10,000円以内' },
  { max: null, label: '指定なし' },
];

/** HotPepperのジャンルマスタ（大ジャンル）に一致させる（REQ-001 §6.2）。 */
export interface GenreOption {
  code: GenreCode;
  label: string;
}

export const GENRE_OPTIONS: readonly GenreOption[] = [
  { code: null, label: 'おまかせ' },
  { code: 'G001', label: '居酒屋' },
  { code: 'G002', label: 'ダイニングバー・バル' },
  { code: 'G012', label: 'バー・カクテル' },
  { code: 'G013', label: 'ラーメン' },
  { code: 'G014', label: 'カフェ・スイーツ' },
];

export interface RangeOption {
  value: RangeCode;
  label: string;
}

export const RANGE_OPTIONS: readonly RangeOption[] = [
  { value: 1, label: '300m' },
  { value: 2, label: '500m' },
  { value: 3, label: '1km' },
  { value: 4, label: '2km' },
];

export const PREFERENCE_LABELS = {
  privateRoom: '個室',
  freeDrink: '飲み放題',
  midnight: '23時以降営業',
} as const;

export function budgetLabel(max: BudgetMax): string {
  return BUDGET_OPTIONS.find((o) => o.max === max)?.label ?? '指定なし';
}

export function rangeLabel(range: RangeCode): string {
  return RANGE_OPTIONS.find((o) => o.value === range)?.label ?? '';
}

export function genreLabel(code: GenreCode): string {
  return GENRE_OPTIONS.find((o) => o.code === code)?.label ?? 'おまかせ';
}

/**
 * 実際に検索した条件を1行で表す。
 *
 * 緩和で条件が変わったとき、何で検索しているのかを画面で示すため。
 */
export function describeCondition(condition: SearchCondition): string {
  const prefs = (Object.keys(PREFERENCE_LABELS) as (keyof typeof PREFERENCE_LABELS)[]).filter(
    (key) => condition.preferences[key],
  );

  return [
    condition.budgetMax === null ? '予算 指定なし' : budgetLabel(condition.budgetMax),
    genreLabel(condition.genreCode),
    `${rangeLabel(condition.range)}以内`,
    prefs.length > 0 ? prefs.map((k) => PREFERENCE_LABELS[k]).join('・') : 'こだわりなし',
  ].join(' / ');
}
