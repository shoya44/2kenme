import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { canPrimeLocation, getCurrentLocation, isGeoFresh, LocationError } from './location';
import { GEO_TTL_MS, hasGeoGranted, markGeoGranted, saveGeo, STORAGE_KEYS } from './storage';
import type { GeoPoint } from '../types';

const point = (acquiredAt: number): GeoPoint => ({ lat: 35.69, lng: 139.7, acquiredAt });

/** 位置情報の取得と鮮度（FE-001 §21 / DATA-001 §6）。 */
function stubGeolocation(coords = { latitude: 35.69, longitude: 139.7 }) {
  const getCurrentPosition = vi.fn((success: PositionCallback) => {
    success({ coords, timestamp: Date.now() } as GeolocationPosition);
  });
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });
  return getCurrentPosition;
}

/** Permissions API の応答を差し替える。`null` は API 自体が無い環境 */
function stubPermissions(state: PermissionState | 'throws' | null) {
  const geolocation = { getCurrentPosition: vi.fn() };
  if (state === null) {
    vi.stubGlobal('navigator', { ...navigator, geolocation, permissions: undefined });
    return;
  }
  const query =
    state === 'throws'
      ? vi.fn(() => Promise.reject(new TypeError('unsupported')))
      : vi.fn(() => Promise.resolve({ state } as PermissionStatus));
  vi.stubGlobal('navigator', { ...navigator, geolocation, permissions: { query } });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isGeoFresh', () => {
  it('鮮度内ならtrue', () => {
    expect(isGeoFresh(point(1000), 1000 + GEO_TTL_MS)).toBe(true);
  });

  it('鮮度切れならfalse', () => {
    expect(isGeoFresh(point(1000), 1000 + GEO_TTL_MS + 1)).toBe(false);
  });

  it('未取得ならfalse', () => {
    expect(isGeoFresh(null)).toBe(false);
  });
});

describe('getCurrentLocation', () => {
  it('鮮度内のキャッシュがあれば再取得しない', async () => {
    const getCurrentPosition = stubGeolocation();
    saveGeo(point(1000));

    await expect(getCurrentLocation(1000 + GEO_TTL_MS)).resolves.toEqual(point(1000));
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('鮮度切れなら取り直す', async () => {
    const getCurrentPosition = stubGeolocation();
    saveGeo(point(1000));

    const now = 1000 + GEO_TTL_MS + 1;
    await expect(getCurrentLocation(now)).resolves.toEqual({ ...point(now) });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('取得に成功すると許可実績を残す（座標は残さない）', async () => {
    stubGeolocation();

    await getCurrentLocation(1000);

    expect(hasGeoGranted()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.geo)).toBeNull();
  });

  it('拒否されたら許可実績を残さない', async () => {
    const getCurrentPosition = vi.fn((_s: PositionCallback, error?: PositionErrorCallback) => {
      error?.({ code: 1, message: 'denied' } as GeolocationPositionError);
    });
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    await expect(getCurrentLocation()).rejects.toThrow(LocationError);
    expect(hasGeoGranted()).toBe(false);
  });
});

describe('canPrimeLocation', () => {
  it('許可実績が無ければ先出ししない', async () => {
    stubPermissions('granted');

    await expect(canPrimeLocation()).resolves.toBe(false);
  });

  it.each([
    ['granted', true],
    ['prompt', false],
    ['denied', false],
  ] as const)('許可実績があり Permissions が %s なら %s', async (state, expected) => {
    markGeoGranted();
    stubPermissions(state);

    await expect(canPrimeLocation()).resolves.toBe(expected);
  });

  it('Permissions API が無ければ許可実績で判断する', async () => {
    markGeoGranted();
    stubPermissions(null);

    await expect(canPrimeLocation()).resolves.toBe(true);
  });

  it('Permissions の照会が例外になっても許可実績で判断する（Safari）', async () => {
    markGeoGranted();
    stubPermissions('throws');

    await expect(canPrimeLocation()).resolves.toBe(true);
  });
});
