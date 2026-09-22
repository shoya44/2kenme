import { calcDistanceMeters, calcWalkMinutes } from './geo';
import type { HotPepperResponse, HotPepperShop } from './hotpepper';
import { MAX_START, type Paging, type Shop } from '../shared/api-types';

/** 数値として解釈できなければ null。欠損を 0 に丸めると (0,0) からの距離になる */
function toFiniteNumber(value: number | string | undefined): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function toNumber(value: number | string | undefined): number {
  return toFiniteNumber(value) ?? 0;
}

/** 空文字・空白だけの自由記述は「未登録」として扱う */
function toText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * 現在地から店舗までの直線距離（m）。緯度経度が欠けていれば null。
 *
 * 「いま居る店」の除外（`NEAR_EXCLUSION_METERS`）と徒歩時間の算出で
 * 同じ距離を使うため、解釈をここに1つだけ置く。
 */
export function shopDistanceMeters(
  shop: HotPepperShop,
  originLat: number,
  originLng: number,
): number | null {
  const lat = toFiniteNumber(shop.lat);
  const lng = toFiniteNumber(shop.lng);
  if (lat === null || lng === null) {
    return null;
  }
  return calcDistanceMeters(originLat, originLng, lat, lng);
}

/**
 * HotPepperの店舗を結果画面が使う形へ落とす（BE-001 §11）。
 *
 * 緯度経度・直線距離は返さない。結果画面で使わず、クライアントへ渡す必要がないため。
 * 必須項目が欠けている店舗は null を返し、呼び出し側で除外する。
 * 緯度経度が欠けている店舗は落とさず、徒歩時間だけを null にする。
 * 確度の低い値を出すより、その項目を表示しない方がよい（BE-001 §11）。
 */
export function mapShop(shop: HotPepperShop, originLat: number, originLng: number): Shop | null {
  const id = shop.id;
  const name = shop.name;
  const hotpepperUrl = shop.urls?.pc;

  if (!id || !name || !hotpepperUrl) {
    return null;
  }

  const distanceMeters = shopDistanceMeters(shop, originLat, originLng);

  return {
    id,
    name,
    photoUrl: shop.photo?.pc?.l ?? shop.photo?.mobile?.l ?? null,
    hotpepperUrl,
    budgetText: shop.budget?.name ?? null,
    walkMinutes: distanceMeters === null ? null : calcWalkMinutes(distanceMeters),
    // 営業中かどうかの判定はしない。自由記述で機械判定が当たらず、
    // 閉店中の店を「営業中」と示す誤りの方が害が大きい（BE-001 §11）
    openText: toText(shop.open),
    closedText: toText(shop.close),
  };
}

/**
 * ページング情報を組み立てる（BE-001 §13）。
 *
 * `MAX_START` を超えるページは要求させない。1検索あたりの上流呼び出しを
 * 有限にするための唯一の判断点をここに置く（BE-001 §4）。
 */
export function mapPaging(body: HotPepperResponse): Paging {
  const start = toNumber(body.results?.results_start);
  const returned = toNumber(body.results?.results_returned);
  const available = toNumber(body.results?.results_available);

  if (returned === 0) {
    return { nextStart: start || 1, hasMore: false };
  }

  const nextStart = start + returned;
  return { nextStart, hasMore: nextStart <= available && nextStart <= MAX_START };
}
