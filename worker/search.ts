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

  // HotPepperの返却順（おすすめ順）を保持する。シャッフルはF/Eが行う
  return json({ shops, paging: mapPaging(upstream) } satisfies SearchResponse);
}

export { UpstreamError };
