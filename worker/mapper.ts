import { calcDistanceMeters, calcWalkMinutes } from './geo';
import type { HotPepperResponse, HotPepperShop } from './hotpepper';
import type { Paging, Shop } from '../shared/api-types';

function toNumber(value: number | string | undefined): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

/**
 * HotPepperの店舗を結果画面が使う形へ落とす（BE-001 §11）。
 *
 * 緯度経度・直線距離は返さない。結果画面で使わず、クライアントへ渡す必要がないため。
 * 必須項目が欠けている店舗は null を返し、呼び出し側で除外する。
 */
export function mapShop(shop: HotPepperShop, originLat: number, originLng: number): Shop | null {
  const id = shop.id;
  const name = shop.name;
  const hotpepperUrl = shop.urls?.pc;

  if (!id || !name || !hotpepperUrl) {
    return null;
  }

  const distanceMeters = calcDistanceMeters(
    originLat,
    originLng,
    toNumber(shop.lat),
    toNumber(shop.lng),
  );

  return {
    id,
    name,
    photoUrl: shop.photo?.pc?.l ?? shop.photo?.mobile?.l ?? null,
    hotpepperUrl,
    budgetText: shop.budget?.name ?? null,
    walkMinutes: calcWalkMinutes(distanceMeters),
  };
}

/** ページング情報を組み立てる（BE-001 §13）。 */
export function mapPaging(body: HotPepperResponse): Paging {
  const start = toNumber(body.results?.results_start);
  const returned = toNumber(body.results?.results_returned);
  const available = toNumber(body.results?.results_available);

  if (returned === 0) {
    return { nextStart: start || 1, hasMore: false };
  }

  const nextStart = start + returned;
  return { nextStart, hasMore: nextStart <= available };
}
