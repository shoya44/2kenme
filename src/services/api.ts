import type { SearchRequest, SearchResponse } from '../../shared/api-types';
import type { GeoPoint, SearchCondition } from '../types';

/** /api/search の呼び出しに失敗したことを示す。 */
export class SearchApiError extends Error {
  constructor(readonly status: number) {
    super(`search failed: ${status}`);
    this.name = 'SearchApiError';
  }
}

/** 条件・現在地・ページング開始位置から店舗候補を取得する（FE-001 §18）。 */
export async function fetchShops(
  condition: SearchCondition,
  location: GeoPoint,
  start: number,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const body: SearchRequest = {
    lat: location.lat,
    lng: location.lng,
    range: condition.range,
    budgetMax: condition.budgetMax,
    includeUnknownBudget: condition.includeUnknownBudget,
    genreCode: condition.genreCode,
    preferences: condition.preferences,
    start,
  };

  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new SearchApiError(response.status);
  }

  return (await response.json()) as SearchResponse;
}
