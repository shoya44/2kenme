import { describe, expect, it } from 'vitest';

import { parseBudgetName } from './parse-budget-name';

/** 予算帯の解析（BE-001 §6 / TEST-001 §4）。 */
describe('parseBudgetName', () => {
  it.each([
    ['～500円', { min: 0, max: 500 }],
    ['~500円', { min: 0, max: 500 }],
    ['501～1000円', { min: 501, max: 1000 }],
    ['2001～3000円', { min: 2001, max: 3000 }],
    ['30001円～', { min: 30001, max: null }],
    ['30001円~', { min: 30001, max: null }],
  ])('%s を解析できる', (name, expected) => {
    expect(parseBudgetName(name)).toEqual(expected);
  });

  it('桁区切りのカンマがあっても解析できる', () => {
    expect(parseBudgetName('2,001～3,000円')).toEqual({ min: 2001, max: 3000 });
  });

  it('前後の空白を無視する', () => {
    expect(parseBudgetName('  501～1000円  ')).toEqual({ min: 501, max: 1000 });
  });

  it.each(['未定', '', '500円くらい', '～円', 'おまかせ'])(
    '解析できない表記は例外にする: %p',
    (name) => {
      // 無言で予算帯が欠落する方が危険なので、必ず失敗させる
      expect(() => parseBudgetName(name)).toThrow();
    },
  );
});
