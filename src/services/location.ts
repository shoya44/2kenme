import { loadGeo, saveGeo } from './storage';
import type { GeoPoint } from '../types';

/** 位置情報の取得に失敗したことを示す。 */
export class LocationError extends Error {
  constructor(readonly reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported') {
    super(`location unavailable: ${reason}`);
    this.name = 'LocationError';
  }
}

const GEOLOCATION_TIMEOUT_MS = 10_000;

/**
 * 現在地を取得する。
 *
 * 取得は「さがす」押下時に開始する。アプリ起動時に取ると、初回起動でいきなり
 * 許可ダイアログが出るため（FE-001 §21）。
 * 同一タブ内で鮮度内のものがあれば再取得しない。
 */
export async function getCurrentLocation(now = Date.now()): Promise<GeoPoint> {
  const cached = loadGeo(now);
  if (cached) {
    return cached;
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new LocationError('unsupported');
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: GEOLOCATION_TIMEOUT_MS,
      maximumAge: 0,
    });
  }).catch((error: unknown) => {
    throw toLocationError(error);
  });

  const point: GeoPoint = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    acquiredAt: now,
  };

  saveGeo(point);
  return point;
}

function toLocationError(error: unknown): LocationError {
  const code = (error as GeolocationPositionError | undefined)?.code;

  if (code === 1) {
    return new LocationError('denied');
  }
  if (code === 3) {
    return new LocationError('timeout');
  }
  return new LocationError('unavailable');
}
