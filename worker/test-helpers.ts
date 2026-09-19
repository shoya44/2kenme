import { vi } from 'vitest';

import type { HotPepperResponse, HotPepperShop } from './hotpepper';
import type { SearchRequest } from '../shared/api-types';

export const ALLOWED_ORIGIN = 'https://tsugidoko.example.com';

export const validRequest: SearchRequest = {
  lat: 35.690921,
  lng: 139.700258,
  range: 3,
  budgetMax: 4000,
  genreCode: 'G001',
  preferences: { privateRoom: false, freeDrink: true, midnight: true },
  start: 1,
};

/** /api/search へのリクエストを作る。既定で許可済みOriginを付ける。 */
export function searchRequest(
  body: unknown = validRequest,
  init: { origin?: string | null; method?: string; rawBody?: string } = {},
): Request {
  const { origin = ALLOWED_ORIGIN, method = 'POST', rawBody } = init;

  const headers = new Headers({ 'content-type': 'application/json' });
  if (origin !== null) {
    headers.set('Origin', origin);
  }

  return new Request(`${ALLOWED_ORIGIN}/api/search`, {
    method,
    headers,
    body: method === 'POST' ? (rawBody ?? JSON.stringify(body)) : null,
  });
}

export function shop(overrides: Partial<HotPepperShop> = {}): HotPepperShop {
  return {
    id: 'J001',
    name: '炭火焼き鳥 とり吉',
    lat: 35.6915,
    lng: 139.7005,
    photo: { pc: { l: 'https://example.com/l.jpg' }, mobile: { l: 'https://example.com/m.jpg' } },
    urls: { pc: 'https://www.hotpepper.jp/strJ001/' },
    budget: { code: 'B003', name: '3001～4000円' },
    ...overrides,
  };
}

export function hotpepperBody(
  shops: HotPepperShop[],
  paging: { start?: number; available?: number; returned?: number } = {},
): HotPepperResponse {
  return {
    results: {
      results_available: paging.available ?? shops.length,
      results_returned: String(paging.returned ?? shops.length),
      results_start: paging.start ?? 1,
      shop: shops,
    },
  };
}

export interface FetchStub {
  /** 呼び出されたURL。パラメータ組み立ての検証に使う */
  readonly calls: string[];
  readonly mock: ReturnType<typeof vi.fn>;
}

/**
 * HotPepperの応答を差し替える。テストから外部への実通信は行わない。
 *
 * @param responder 応答、または呼び出しごとの挙動を決める関数
 */
export function stubFetch(
  responder: unknown | ((url: string) => Response | Promise<Response>),
): FetchStub {
  const calls: string[] = [];

  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);

    if (typeof responder === 'function') {
      return (responder as (u: string) => Response | Promise<Response>)(url);
    }
    return new Response(JSON.stringify(responder), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', mock);
  return { calls, mock };
}

/** 差し替えたfetchが受け取ったクエリパラメータ。 */
export function paramsOf(stub: FetchStub, index = 0): URLSearchParams {
  const url = stub.calls[index];
  if (!url) {
    throw new Error(`fetch呼び出し[${index}]がありません`);
  }
  return new URL(url).searchParams;
}
