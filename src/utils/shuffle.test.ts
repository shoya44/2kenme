import { describe, expect, it } from 'vitest';

import { shuffleInChunks } from './shuffle';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** ブロック単位シャッフル（FE-001 §19 / TEST-001 §5）。 */
describe('shuffleInChunks', () => {
  it('要素集合が入力と一致する（欠落・重複なし）', () => {
    const input = range(55);

    const result = shuffleInChunks(input, 10);

    expect(result).toHaveLength(input.length);
    expect([...result].sort((a, b) => a - b)).toEqual(input);
  });

  it('ブロック境界を越えて要素が移動しない', () => {
    const input = range(50);

    const result = shuffleInChunks(input, 10);

    for (let start = 0; start < 50; start += 10) {
      const block = result.slice(start, start + 10).sort((a, b) => a - b);
      expect(block).toEqual(input.slice(start, start + 10));
    }
  });

  it('端数ブロックが壊れない（55件 → 最後は5件）', () => {
    const input = range(55);

    const result = shuffleInChunks(input, 10);

    expect(result.slice(50).sort((a, b) => a - b)).toEqual([50, 51, 52, 53, 54]);
  });

  it('元の配列を変更しない', () => {
    const input = range(20);
    const copy = [...input];

    shuffleInChunks(input, 10);

    expect(input).toEqual(copy);
  });

  it('空配列で例外にならない', () => {
    expect(shuffleInChunks([], 10)).toEqual([]);
  });

  it('1件で例外にならない', () => {
    expect(shuffleInChunks(['a'], 10)).toEqual(['a']);
  });

  it('要素数がchunkSizeより少なくても動く', () => {
    const result = shuffleInChunks(range(3), 10);

    expect([...result].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it('chunkSizeが0以下なら例外', () => {
    expect(() => shuffleInChunks(range(5), 0)).toThrow();
  });

  it('十分な試行で順序が変わる（常に同じ順序ではない）', () => {
    const input = range(10);

    const seen = new Set(Array.from({ length: 50 }, () => shuffleInChunks(input, 10).join(',')));

    expect(seen.size).toBeGreaterThan(1);
  });
});
