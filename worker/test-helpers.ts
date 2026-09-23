import { vi } from 'vitest';

import type { HotPepperResponse, HotPepperShop } from './hotpepper';
import { APP_TOKEN_HEADER, type SearchRequest } from '../shared/api-types';

export const ALLOWED_ORIGIN = 'https://tsugidoko.example.com';

/** テスト用の合言葉。実値は使わない */
export const APP_PASSCODE = 'test-passcode';

export const validRequest: SearchRequest = {
  lat: 35.690921,
  lng: 139.700258,
  range: 3,
  budgetMax: 4000,
  includeUnknownBudget: false,
  genreCode: 'G001',
  preferences: { privateRoom: false, freeDrink: true, midnight: true },
  start: 1,
};

/** /api/search へのリクエストを作る。既定で許可済みOriginと合言葉を付ける。 */
export function searchRequest(
  body: unknown = validRequest,
  init: {
    origin?: string | null;
    method?: string;
    rawBody?: string;
    /** 合言葉。null なら付けない */
    passcode?: string | null;
  } = {},
): Request {
  const { origin = ALLOWED_ORIGIN, method = 'POST', rawBody, passcode = APP_PASSCODE } = init;

  const headers = new Headers({ 'content-type': 'application/json' });
  if (origin !== null) {
    headers.set('Origin', origin);
  }
  if (passcode !== null) {
    headers.set(APP_TOKEN_HEADER, passcode);
  }

  return new Request(`${ALLOWED_ORIGIN}/api/search`, {
    method,
    headers,
    body: method === 'POST' ? (rawBody ?? JSON.stringify(body)) : null,
  });
}

/** 明示的な undefined を渡して項目欠落を再現できるようにする。 */
type ShopOverrides = { [K in keyof HotPepperShop]?: HotPepperShop[K] | undefined };

export function shop(overrides: ShopOverrides = {}): HotPepperShop {
  const base: ShopOverrides = {
    id: 'J001',
    name: '炭火焼き鳥 とり吉',
    lat: 35.6915,
    lng: 139.7005,
    photo: { pc: { l: 'https://example.com/l.jpg' }, mobile: { l: 'https://example.com/m.jpg' } },
    urls: { pc: 'https://www.hotpepper.jp/strJ001/' },
    budget: { code: 'B003', name: '3001～4000円' },
    open: '月～日、祝日、祝前日: 17:00～翌2:00',
    close: '日曜日',
  };
  return { ...base, ...overrides } as HotPepperShop;
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
