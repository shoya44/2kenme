import { describe, expect, it } from 'vitest';

import { HttpError } from './http';
import { validRequest } from './test-helpers';
import { validateSearchRequest } from './validation';

/** 入力検証（BE-001 §4 / TEST-001 §4）。 */
describe('validateSearchRequest', () => {
  const withField = (field: string, value: unknown) => ({ ...validRequest, [field]: value });

  const expectBadRequest = (body: unknown) => {
    try {
      validateSearchRequest(body);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
      return;
    }
    throw new Error('400にならなかった');
  };

  it('正常系が通る', () => {
    expect(validateSearchRequest(validRequest)).toEqual(validRequest);
  });

  it.each([null, undefined, 'x', 42, []])('本文がオブジェクトでなければ400: %p', (body) => {
    expectBadRequest(body);
  });

  describe('lat / lng', () => {
    it.each([-90.1, 90.1, Number.NaN, Number.POSITIVE_INFINITY, '35', null, undefined])(
      'latが不正なら400: %p',
      (lat) => expectBadRequest(withField('lat', lat)),
    );

    it.each([-180.1, 180.1, Number.NaN, '139', null, undefined])('lngが不正なら400: %p', (lng) =>
      expectBadRequest(withField('lng', lng)),
    );

    it.each([-90, 90, 0])('latの境界値は通る: %p', (lat) => {
      expect(validateSearchRequest(withField('lat', lat)).lat).toBe(lat);
    });

    it.each([-180, 180, 0])('lngの境界値は通る: %p', (lng) => {
      expect(validateSearchRequest(withField('lng', lng)).lng).toBe(lng);
    });
  });

  describe('range', () => {
    it.each([0, 5, 1.5, '3', null, undefined])('不正なら400: %p', (range) =>
      expectBadRequest(withField('range', range)),
    );

    it.each([1, 2, 3, 4])('1〜4は通る: %p', (range) => {
      expect(validateSearchRequest(withField('range', range)).range).toBe(range);
    });
  });

  describe('budgetMax', () => {
    it.each([3500, 0, -1, 15000, '4000', undefined])('許可値以外なら400: %p', (budgetMax) =>
      expectBadRequest(withField('budgetMax', budgetMax)),
    );

    it('nullは通る（上限なし）', () => {
      expect(validateSearchRequest(withField('budgetMax', null)).budgetMax).toBeNull();
    });

    it.each([2000, 3000, 4000, 5000, 7000, 10000])('許可値は通る: %p', (budgetMax) => {
      expect(validateSearchRequest(withField('budgetMax', budgetMax)).budgetMax).toBe(budgetMax);
    });
  });

  describe('genreCode', () => {
    it.each(['G999', 'G001; DROP', '', 1, undefined])('未登録コードなら400: %p', (genreCode) =>
      expectBadRequest(withField('genreCode', genreCode)),
    );

    it('nullは通る（おまかせ）', () => {
      expect(validateSearchRequest(withField('genreCode', null)).genreCode).toBeNull();
    });

    it.each(['G001', 'G002', 'G012', 'G013', 'G014'])('許可コードは通る: %p', (genreCode) => {
      expect(validateSearchRequest(withField('genreCode', genreCode)).genreCode).toBe(genreCode);
    });
  });

  describe('preferences', () => {
    it.each([null, undefined, 'x', []])('オブジェクトでなければ400: %p', (preferences) =>
      expectBadRequest(withField('preferences', preferences)),
    );

    it.each(['privateRoom', 'freeDrink', 'midnight'])('%s がbooleanでなければ400', (key) =>
      expectBadRequest(withField('preferences', { ...validRequest.preferences, [key]: 'true' })),
    );

    it('欠けているキーがあれば400', () =>
      expectBadRequest(withField('preferences', { privateRoom: true })));
  });

  describe('start', () => {
    it.each([0, -1, 1.5, '1', null, undefined])('不正なら400: %p', (start) =>
      expectBadRequest(withField('start', start)),
    );

    it('1以上の整数は通る', () => {
      expect(validateSearchRequest(withField('start', 51)).start).toBe(51);
    });
  });
});
