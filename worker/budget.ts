import { BUDGET_MASTER } from './budget-master.generated';
import type { BudgetMax } from '../shared/api-types';

/**
 * HotPepper の `budget` パラメータに指定できるコード数の上限。
 *
 * リファレンスで上限の記載を確認できていないため、既定では制限しない。
 * 上限が判明したらここに数値を入れる。安い帯ほど2軒目の候補として落としたくないので、
 * 切り捨てるのは下位（安い）側とする（BE-001 §6）。
 */
export const BUDGET_CODE_LIMIT: number | null = null;

/**
 * 予算上限（円）を HotPepper の予算コード群へ変換する。
 *
 * 上限が `budgetMax` 以下に収まる予算帯をすべて対象にする。
 * 「4,000円以内」なら4,000円以下の帯を全部含める、という上限指定の意味（REQ-001 §6.1）。
 *
 * @returns 送信する予算コード。空配列なら `budget` パラメータ自体を送らない
 */
export function toBudgetCodes(budgetMax: BudgetMax, limit = BUDGET_CODE_LIMIT): string[] {
  if (budgetMax === null) {
    return [];
  }

  const codes = BUDGET_MASTER.filter((entry) => entry.max !== null && entry.max <= budgetMax).map(
    (entry) => entry.code,
  );

  if (limit !== null && codes.length > limit) {
    // 上限に近い側（＝高い帯）を優先して残す
    return codes.slice(-limit);
  }

  return codes;
}

/**
 * 店舗の予算コードが上限内かを判定する。
 *
 * 予算が未登録（コードなし）の店舗は `true` を返す。HotPepperの絞り込みでは
 * 一律に除外されてしまうが、「予算未登録も含める」ときは候補に残すため。
 */
export function isWithinBudgetMax(code: string | undefined, budgetMax: BudgetMax): boolean {
  if (budgetMax === null || !code) {
    return true;
  }

  const entry = BUDGET_MASTER.find((e) => e.code === code);
  if (!entry) {
    // マスタにないコード。生成物が古い可能性があるので落とさず残す
    return true;
  }

  return entry.max !== null && entry.max <= budgetMax;
}
