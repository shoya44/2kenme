import { describe, expect, it } from 'vitest';

import { BUDGET_MASTER } from './budget-master.generated';
import { toBudgetCodes } from './budget';

/** 予算上限 → 予算コード変換（BE-001 §6 / TEST-001 §4）。 */
describe('toBudgetCodes', () => {
  it('上限なし（null）ならパラメータを送らない', () => {
    expect(toBudgetCodes(null)).toEqual([]);
  });

  it('上限が2,000円なら、上限2,000円以下の帯だけを含む', () => {
    const codes = toBudgetCodes(2000);

    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      const entry = BUDGET_MASTER.find((e) => e.code === code);
      expect(entry?.max).not.toBeNull();
      expect(entry?.max).toBeLessThanOrEqual(2000);
    }
  });

  it('上限を超える帯を含まない', () => {
    const codes = toBudgetCodes(3000);
    const over = BUDGET_MASTER.filter((e) => e.max !== null && e.max > 3000).map((e) => e.code);

    expect(codes).not.toEqual(expect.arrayContaining(over));
  });

  it('上限を上げると対象が広がる', () => {
    expect(toBudgetCodes(10000).length).toBeGreaterThan(toBudgetCodes(2000).length);
  });

  it('上限10,000円でも、上限なしの帯は含まない', () => {
    const openEnded = BUDGET_MASTER.filter((e) => e.max === null).map((e) => e.code);

    expect(openEnded.length).toBeGreaterThan(0);
    expect(toBudgetCodes(10000)).not.toEqual(expect.arrayContaining(openEnded));
  });

  it('コード数の上限が設定されている場合、高い帯を優先して残す', () => {
    const all = toBudgetCodes(10000);
    const limited = toBudgetCodes(10000, 3);

    expect(limited).toHaveLength(3);
    expect(limited).toEqual(all.slice(-3));
  });

  it('コード数が上限以下なら切り捨てない', () => {
    expect(toBudgetCodes(2000, 99)).toEqual(toBudgetCodes(2000));
  });
});

describe('BUDGET_MASTER', () => {
  it('空でない', () => {
    expect(BUDGET_MASTER.length).toBeGreaterThan(0);
  });

  it('各エントリの min <= max（上限ありの帯）', () => {
    for (const entry of BUDGET_MASTER) {
      if (entry.max !== null) {
        expect(entry.min).toBeLessThanOrEqual(entry.max);
      }
    }
  });

  it('コードが重複しない', () => {
    const codes = BUDGET_MASTER.map((e) => e.code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  it('UIが選べる各上限に対して、1件以上の帯が該当する', () => {
    for (const max of [2000, 3000, 4000, 5000, 7000, 10000] as const) {
      expect(toBudgetCodes(max).length).toBeGreaterThan(0);
    }
  });
});
