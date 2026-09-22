import { describe, expect, it } from 'vitest';

import { isLateNight, withLateNightDefault } from './latenight';
import { DEFAULT_CONDITION } from '../services/storage';

const at = (hour: number, minute = 0) => new Date(2026, 8, 22, hour, minute, 0);

/** 深夜帯の判定と既定ON（FE-001 §7 / TEST-001 §5）。 */
describe('isLateNight', () => {
  it.each([
    [at(22, 29), false],
    [at(22, 30), true],
    [at(23, 0), true],
    [at(0, 30), true],
    [at(4, 59), true],
    [at(5, 0), false],
    [at(12, 0), false],
    [at(19, 0), false],
  ])('%s → %s', (now, expected) => {
    expect(isLateNight(now)).toBe(expected);
  });
});

describe('withLateNightDefault', () => {
  it('深夜帯なら「23時以降営業」をONにする', () => {
    const result = withLateNightDefault(DEFAULT_CONDITION, at(23, 30));

    expect(result.preferences.midnight).toBe(true);
    // 他の条件は変えない
    expect(result.budgetMax).toBe(DEFAULT_CONDITION.budgetMax);
    expect(result.preferences.privateRoom).toBe(false);
  });

  it('深夜帯でなければ何も変えない', () => {
    const condition = withLateNightDefault(DEFAULT_CONDITION, at(19));

    expect(condition).toBe(DEFAULT_CONDITION);
  });

  it('すでにONなら同じ条件を返す', () => {
    const on = {
      ...DEFAULT_CONDITION,
      preferences: { ...DEFAULT_CONDITION.preferences, midnight: true },
    };

    expect(withLateNightDefault(on, at(23))).toBe(on);
  });

  it('元の条件を書き換えない', () => {
    withLateNightDefault(DEFAULT_CONDITION, at(23));

    expect(DEFAULT_CONDITION.preferences.midnight).toBe(false);
  });
});
