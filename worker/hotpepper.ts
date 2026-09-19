import { toBudgetCodes } from './budget';
import { HttpError } from './http';
import type { SearchRequest } from '../shared/api-types';

const DEFAULT_ENDPOINT = 'https://webservice.recruit.co.jp/hotpepper/gourmet/v1/';

/**
 * 実APIへ到達できない環境で通し確認をするための差し替え口。
 * wrangler.jsonc の vars には置かず、ローカルの .dev.vars からのみ与える。
 */
function endpoint(override?: string): string {
  return override && override.length > 0 ? override : DEFAULT_ENDPOINT;
}

/** 1回の検索で取得する件数（REQ-001 §8）。 */
export const COUNT_PER_PAGE = 50;

/** HotPepper通信のタイムアウト（ms）。自動リトライはしない（BE-001 §10）。 */
const TIMEOUT_MS = 5_000;

/** HotPepperのレスポンス（本アプリが使う項目のみ）。 */
export interface HotPepperResponse {
  results: {
    api_version?: string;
    results_available?: number | string;
    results_returned?: number | string;
    results_start?: number | string;
    shop?: HotPepperShop[];
    error?: { code?: number | string; message?: string }[];
  };
}

export interface HotPepperShop {
  id?: string;
  name?: string;
  lat?: number | string;
  lng?: number | string;
  photo?: { pc?: { l?: string; m?: string; s?: string }; mobile?: { l?: string; s?: string } };
  urls?: { pc?: string };
  budget?: { code?: string; name?: string; average?: string };
}

/**
 * HotPepperへ渡すクエリを組み立てる（BE-001 §7）。
 *
 * false の boolean 条件と、指定なしの予算・ジャンルはパラメータごと省略する。
 */
export function buildHotPepperParams(request: SearchRequest, apiKey: string): URLSearchParams {
  const params = new URLSearchParams({
    key: apiKey,
    format: 'json',
    datum: 'world',
    count: String(COUNT_PER_PAGE),
    // おすすめ順。ソート順に距離順は存在しないため既定値に依存せず明示する
    order: '4',
    lat: String(request.lat),
    lng: String(request.lng),
    range: String(request.range),
    start: String(request.start),
  });

  const budgetCodes = toBudgetCodes(request.budgetMax);
  if (budgetCodes.length > 0) {
    params.set('budget', budgetCodes.join(','));
  }

  if (request.genreCode !== null) {
    params.set('genre', request.genreCode);
  }

  if (request.preferences.privateRoom) {
    params.set('private_room', '1');
  }
  if (request.preferences.freeDrink) {
    params.set('free_drink', '1');
  }
  if (request.preferences.midnight) {
    params.set('midnight', '1');
  }

  return params;
}

/** HotPepperを呼ぶ。通信失敗は502、タイムアウトは504。 */
export async function fetchHotPepper(
  params: URLSearchParams,
  endpointOverride?: string,
): Promise<HotPepperResponse> {
  let response: Response;
  try {
    response = await fetch(`${endpoint(endpointOverride)}?${params.toString()}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new HttpError(504, 'upstream timeout');
    }
    throw new HttpError(502, 'upstream unavailable');
  }

  if (!response.ok) {
    throw new HttpError(502, 'upstream unavailable');
  }

  try {
    return (await response.json()) as HotPepperResponse;
  } catch {
    throw new HttpError(502, 'upstream unavailable');
  }
}

/**
 * HotPepperはAPIエラー時もHTTP 200を返すため、`results.error` を必ず確認する（BE-001 §9）。
 *
 * @returns 上流のエラーコード。ログに残す用途
 */
export function assertHotPepperSuccess(body: HotPepperResponse): void {
  const error = body.results?.error?.[0];
  if (!error) {
    return;
  }
  const code = Number(error.code);
  // 2000（キー/IP認証）と3000（パラメータ不正）は自アプリの不具合を示す。
  // ユーザーへは同じ502だが、呼び出し側でログレベルを変える
  throw new UpstreamError(code);
}

/** HotPepperが `results.error` を返したことを示す。 */
export class UpstreamError extends Error {
  constructor(readonly code: number) {
    super(`hotpepper error ${code}`);
    this.name = 'UpstreamError';
  }
}
