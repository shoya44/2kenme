import { HttpError, json } from './http';
import {
  assertHotPepperSuccess,
  buildHotPepperParams,
  fetchHotPepper,
  UpstreamError,
} from './hotpepper';
import { mapPaging, mapShop } from './mapper';
import { validateSearchRequest } from './validation';
import type { SearchResponse, Shop } from '../shared/api-types';
import type { WorkerEnv } from './env';

/** POST /api/search のユースケース（BE-001 §1）。 */
export async function handleSearch(request: Request, env: WorkerEnv): Promise<Response> {
  // Secret の登録漏れ（wrangler secret put のし忘れ）を上流の認証エラーに
  // 化けさせず、設定不備として切り分けられるようにする
  if (!env.HOTPEPPER_API_KEY) {
    throw new HttpError(500, 'not configured');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }

  const searchRequest = validateSearchRequest(body);

  const params = buildHotPepperParams(searchRequest, env.HOTPEPPER_API_KEY);
  const upstream = await fetchHotPepper(params, env.HOTPEPPER_ENDPOINT);
  assertHotPepperSuccess(upstream);

  const shops: Shop[] = [];
  for (const raw of upstream.results?.shop ?? []) {
    const shop = mapShop(raw, searchRequest.lat, searchRequest.lng);
    if (shop) {
      shops.push(shop);
    }
  }

  // 「候補が少ない」原因を切り分けるための診断ログ。
  // どの絞り込みが効いて件数が落ちているかを後から追えるようにする。
  // 緯度経度と店舗名は出さない（BE-001 §18）
  console.log('upstream search', {
    resultsAvailable: Number(upstream.results?.results_available ?? 0),
    returned: shops.length,
    budgetCodes: params.get('budget')?.split(',').length ?? 0,
    genre: searchRequest.genreCode ?? 'any',
    range: searchRequest.range,
    preferences: Object.values(searchRequest.preferences).filter(Boolean).length,
  });

  // HotPepperの返却順（おすすめ順）を保持する。シャッフルはF/Eが行う
  return json({ shops, paging: mapPaging(upstream) } satisfies SearchResponse);
}

export { UpstreamError };
