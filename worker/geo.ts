/** 地球の平均半径（m） */
const EARTH_RADIUS_M = 6_371_000;

/**
 * 直線距離に対する市街地の道なり距離の概算倍率（迂回率）。
 * 厳密な経路計算は行わない（BE-001 §14）。
 */
const DETOUR_RATIO = 1.3;

/** 徒歩速度。不動産表示で慣例的に用いられる分速80m。 */
const WALK_SPEED_M_PER_MIN = 80;

/**
 * この距離より近い店舗は候補から外す（BE-001 §11）。
 *
 * 2軒目を探すのは1軒目の店内なので、現在地と同じ地点の店舗は
 * たいてい「いま居る店」になる。HotPepperの緯度経度は代表点で誤差を含むため、
 * 同一ビル内の別店舗まで落としすぎない範囲に留める。
 */
export const NEAR_EXCLUSION_METERS = 40;

/** Haversine式による2地点間の直線距離（m）。 */
export function calcDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * 徒歩時間（分）の概算。
 *
 * HotPepperの緯度経度は店舗の代表点で誤差を含むため、UI表記は「徒歩 約N分」とする。
 * 同一地点でも0分とは表示しないため下限を1分とする。
 */
export function calcWalkMinutes(distanceMeters: number): number {
  return Math.max(1, Math.ceil((distanceMeters * DETOUR_RATIO) / WALK_SPEED_M_PER_MIN));
}
