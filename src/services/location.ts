import { GEO_TTL_MS, hasGeoGranted, loadGeo, markGeoGranted, saveGeo } from './storage';
import type { GeoPoint } from '../types';

/** 位置情報の取得に失敗したことを示す。 */
export class LocationError extends Error {
  constructor(readonly reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported') {
    super(`location unavailable: ${reason}`);
    this.name = 'LocationError';
  }
}

const GEOLOCATION_TIMEOUT_MS = 10_000;

/** 取得済みの現在地が鮮度内か（FE-001 §21）。 */
export function isGeoFresh(point: GeoPoint | null, now = Date.now()): boolean {
  return point !== null && now - point.acquiredAt <= GEO_TTL_MS;
}

/**
 * 許可ダイアログを出さずに現在地を先出しできるか（FE-001 §21）。
 *
 * 初回起動でいきなりダイアログを出さないため、一度も許可が済んでいなければ
 * 取得しない。Permissions API が使える環境では、あとから許可を取り消した
 * ケース（`prompt` / `denied`）も除く。Safari は geolocation を照会できず
 * 例外になるので、その場合は取得実績だけで判断する。
 */
export async function canPrimeLocation(): Promise<boolean> {
  if (!hasGeoGranted()) {
    return false;
  }

  const state = await permissionState();
  return state === null || state === 'granted';
}

async function permissionState(): Promise<PermissionState | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return null;
    }
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    // Safari は geolocation を照会できない
    return null;
  }
}

/**
 * 現在地を取得する。
 *
 * 初回は「さがす」押下時に取得する。押下と同じ操作文脈で許可を求めるため
 * （FE-001 §21）。一度許可が済んでいれば、次回以降は起動時に先出しする。
 * 鮮度内のものがあれば再取得しない。
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
  // 座標は残さず「許可が済んでいる」事実だけを残す（DATA-001 §6）
  markGeoGranted();
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
