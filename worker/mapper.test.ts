import { describe, expect, it } from 'vitest';

import { COUNT_PER_PAGE } from './hotpepper';
import { mapPaging, mapShop } from './mapper';
import { hotpepperBody, shop, validRequest } from './test-helpers';
import { MAX_START } from '../shared/api-types';

const { lat, lng } = validRequest;

/** レスポンス整形（BE-001 §11 / TEST-001 §4）。 */
describe('mapShop', () => {
  it('必要な項目だけを返す', () => {
    const result = mapShop(shop(), lat, lng);

    expect(result).toEqual({
      id: 'J001',
      name: '炭火焼き鳥 とり吉',
      photoUrl: 'https://example.com/l.jpg',
      hotpepperUrl: 'https://www.hotpepper.jp/strJ001/',
      budgetText: '3001～4000円',
      walkMinutes: expect.any(Number),
    });
  });

  it('緯度経度・直線距離をレスポンスに含めない', () => {
    const result = mapShop(shop(), lat, lng);

    expect(result).not.toHaveProperty('lat');
    expect(result).not.toHaveProperty('lng');
    expect(result).not.toHaveProperty('distanceMeters');
  });

  it('pcの写真が無ければmobileを使う', () => {
    const result = mapShop(
      shop({ photo: { mobile: { l: 'https://example.com/m.jpg' } } }),
      lat,
      lng,
    );

    expect(result?.photoUrl).toBe('https://example.com/m.jpg');
  });

  it('写真が無ければnull', () => {
    expect(mapShop(shop({ photo: undefined }), lat, lng)?.photoUrl).toBeNull();
  });

  it('予算が無ければnull', () => {
    expect(mapShop(shop({ budget: undefined }), lat, lng)?.budgetText).toBeNull();
  });

  it.each([
    ['id', { id: undefined }],
    ['name', { name: undefined }],
    ['urls.pc', { urls: undefined }],
  ])('%s が欠けている店舗はnullを返す', (_label, overrides) => {
    expect(mapShop(shop(overrides), lat, lng)).toBeNull();
  });

  it.each([
    ['緯度が無い', { lat: undefined }],
    ['経度が無い', { lng: undefined }],
    ['緯度が数値にならない', { lat: 'unknown' }],
  ])('%s店舗は残し、徒歩時間を null にする', (_label, overrides) => {
    const result = mapShop(shop(overrides), lat, lng);

    expect(result?.id).toBe('J001');
    expect(result?.walkMinutes).toBeNull();
  });

  it('文字列で返る緯度経度も扱える', () => {
    const a = mapShop(shop({ lat: '35.6915', lng: '139.7005' }), lat, lng);
    const b = mapShop(shop({ lat: 35.6915, lng: 139.7005 }), lat, lng);

    expect(a?.walkMinutes).toBe(b?.walkMinutes);
  });
});

describe('mapPaging', () => {
  it('start=1 / returned=50 / available=120 → nextStart=51 / hasMore=true', () => {
    const body = hotpepperBody([], { start: 1, available: 120, returned: 50 });

    expect(mapPaging(body)).toEqual({ nextStart: 51, hasMore: true });
  });

  it('start=101 / returned=20 / available=120 → nextStart=121 / hasMore=false', () => {
    const body = hotpepperBody([], { start: 101, available: 120, returned: 20 });

    expect(mapPaging(body)).toEqual({ nextStart: 121, hasMore: false });
  });

  it('ちょうど取り切った場合 hasMore=false', () => {
    const body = hotpepperBody([], { start: 51, available: 100, returned: 50 });

    expect(mapPaging(body)).toEqual({ nextStart: 101, hasMore: false });
  });

  it('0件なら nextStart=1 / hasMore=false', () => {
    const body = hotpepperBody([], { start: 1, available: 0, returned: 0 });

    expect(mapPaging(body)).toEqual({ nextStart: 1, hasMore: false });
  });

  it('MAX_START は取得件数の倍数+1（ページ境界と一致する）', () => {
    expect((MAX_START - 1) % COUNT_PER_PAGE).toBe(0);
  });

  it('MAX_START を超えるページは要求させない', () => {
    const body = hotpepperBody([], {
      start: MAX_START,
      available: 100_000,
      returned: 50,
    });

    expect(mapPaging(body)).toEqual({ nextStart: MAX_START + 50, hasMore: false });
  });

  it('results_returned が文字列でも扱える', () => {
    const body = { results: { results_start: 1, results_returned: '50', results_available: 120 } };

    expect(mapPaging(body)).toEqual({ nextStart: 51, hasMore: true });
  });
});
