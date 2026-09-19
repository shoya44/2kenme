import { describe, expect, it } from 'vitest';

import { calcDistanceMeters, calcWalkMinutes } from './geo';

/** 距離・徒歩時間（BE-001 §14 / TEST-001 §4）。 */
describe('calcDistanceMeters', () => {
  it('同一地点は0m', () => {
    expect(calcDistanceMeters(35.6895, 139.6917, 35.6895, 139.6917)).toBe(0);
  });

  it('既知の2地点間の距離が許容誤差内（東京駅〜新宿駅 約6.3km）', () => {
    const d = calcDistanceMeters(35.681236, 139.767125, 35.690921, 139.700258);

    expect(d).toBeGreaterThan(6000);
    expect(d).toBeLessThan(6600);
  });

  it('緯度1度は約111km', () => {
    const d = calcDistanceMeters(35, 139, 36, 139);

    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('向きを入れ替えても同じ距離', () => {
    const a = calcDistanceMeters(35.1, 139.1, 35.2, 139.2);
    const b = calcDistanceMeters(35.2, 139.2, 35.1, 139.1);

    expect(a).toBeCloseTo(b, 6);
  });
});

describe('calcWalkMinutes', () => {
  it('距離0でも1分（0分とは表示しない）', () => {
    expect(calcWalkMinutes(0)).toBe(1);
  });

  it('直線400m → 歩行520m → 7分', () => {
    expect(calcWalkMinutes(400)).toBe(7);
  });

  it('直線1km → 歩行1.3km → 17分', () => {
    expect(calcWalkMinutes(1000)).toBe(17);
  });

  it('切り上げる', () => {
    // 歩行80mちょうどで1分、81mなら2分
    expect(calcWalkMinutes(80 / 1.3)).toBe(1);
    expect(calcWalkMinutes(81 / 1.3)).toBe(2);
  });

  it('距離が増えれば単調に増える', () => {
    expect(calcWalkMinutes(2000)).toBeGreaterThan(calcWalkMinutes(1000));
  });
});
