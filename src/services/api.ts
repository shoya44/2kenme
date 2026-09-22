import type { SearchRequest, SearchResponse } from '../../shared/api-types';
import type { GeoPoint, SearchCondition } from '../types';

/** /api/search の呼び出しに失敗したことを示す。 */
export class SearchApiError extends Error {
  constructor(readonly status: number) {
    super(`search failed: ${status}`);
    this.name = 'SearchApiError';
  }
}

/** 合言葉を載せるヘッダ（BE-001 §5）。 */
const APP_TOKEN_HEADER = 'X-App-Token';

/** 条件・現在地・ページング開始位置から店舗候補を取得する（FE-001 §18）。 */
export async function fetchShops(
  condition: SearchCondition,
  location: GeoPoint,
  start: number,
  passcode: string | null,
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

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (passcode !== null) {
    headers[APP_TOKEN_HEADER] = passcode;
  }

  const response = await fetch('/api/search', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new SearchApiError(response.status);
  }

  return (await response.json()) as SearchResponse;
}
