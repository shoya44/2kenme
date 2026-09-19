import { describe, expect, it } from 'vitest';

import { applyRelax, nextRelaxLevel } from './relax';
import type { SearchCondition } from '../types';

const base: SearchCondition = {
  budgetMax: 4000,
  genreCode: 'G001',
  preferences: { privateRoom: true, freeDrink: true, midnight: true },
  range: 3,
};

/** 条件緩和（FE-001 §15 / TEST-001 §5）。 */
describe('applyRelax', () => {
  it('level 0 は条件を変えない', () => {
    expect(applyRelax(base, 0)).toEqual(base);
  });

  it('level 1 は preferences を全false、他は不変', () => {
    const result = applyRelax(base, 1);

    expect(result.preferences).toEqual({
      privateRoom: false,
      freeDrink: false,
      midnight: false,
    });
    expect(result.genreCode).toBe('G001');
    expect(result.range).toBe(3);
    expect(result.budgetMax).toBe(4000);
  });

  it('level 2 は level 1 に加えて genreCode を null', () => {
    const result = applyRelax(base, 2);

    expect(result.preferences.freeDrink).toBe(false);
    expect(result.genreCode).toBeNull();
    expect(result.range).toBe(3);
  });

  it('level 3 は level 2 に加えて range を1段階拡大', () => {
    const result = applyRelax(base, 3);

    expect(result.genreCode).toBeNull();
    expect(result.range).toBe(4);
    expect(result.budgetMax).toBe(4000);
  });

  it('range が既に4なら level 3 でも4のまま（上限を超えない）', () => {
    expect(applyRelax({ ...base, range: 4 }, 3).range).toBe(4);
  });

  it('level 4 は level 3 に加えて budgetMax を null', () => {
    const result = applyRelax(base, 4);

    expect(result.preferences.privateRoom).toBe(false);
    expect(result.genreCode).toBeNull();
    expect(result.range).toBe(4);
    expect(result.budgetMax).toBeNull();
  });

  it('元の condition を破壊しない', () => {
    const original = structuredClone(base);

    applyRelax(base, 4);

    expect(base).toEqual(original);
  });

  it('preferences を共有しない（参照が別）', () => {
    const result = applyRelax(base, 0);

    expect(result.preferences).not.toBe(base.preferences);
  });
});

describe('nextRelaxLevel', () => {
  it.each([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ] as const)('level %i の次は %i', (current, expected) => {
    expect(nextRelaxLevel(base, current)).toBe(expected);
  });

  it('level 4 の次は無い', () => {
    expect(nextRelaxLevel(base, 4)).toBeNull();
  });

  it('range が上限なら段階3を飛ばして4へ', () => {
    expect(nextRelaxLevel({ ...base, range: 4 }, 2)).toBe(4);
  });
});
