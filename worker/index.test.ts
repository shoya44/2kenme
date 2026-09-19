import { SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkerEnv } from './env';
import worker from './index';
import {
  ALLOWED_ORIGIN,
  hotpepperBody,
  paramsOf,
  searchRequest,
  shop,
  stubFetch,
  validRequest,
} from './test-helpers';

const env: WorkerEnv = { HOTPEPPER_API_KEY: 'test-key', ALLOWED_ORIGIN };

/** worker を直接呼ぶ。SELF は外部fetchの差し替えが効かないため。 */
function call(request: Request): Promise<Response> {
  return worker.fetch(request, env);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** ルーティング（BE-001 §15 / TEST-001 §4）。 */
describe('routing', () => {
  it('未定義のパスは404', async () => {
    const res = await SELF.fetch(`${ALLOWED_ORIGIN}/api/unknown`, { method: 'POST' });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'not found' });
  });

  it('/api/search へのGETは405', async () => {
    const res = await call(searchRequest(validRequest, { method: 'GET' }));

    expect(res.status).toBe(405);
  });

  it('エラー応答はJSONで返る', async () => {
    const res = await SELF.fetch(`${ALLOWED_ORIGIN}/api/unknown`, { method: 'POST' });

    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

/** Origin検証（BE-001 §5）。 */
describe('Origin検証', () => {
  it('Originが一致すれば処理される', async () => {
    stubFetch(hotpepperBody([shop()]));

    const res = await call(searchRequest());

    expect(res.status).toBe(200);
  });

  it('Originが不一致なら403', async () => {
    const stub = stubFetch(hotpepperBody([shop()]));

    const res = await call(searchRequest(validRequest, { origin: 'https://evil.example.com' }));

    expect(res.status).toBe(403);
    // 上流を叩かずに弾く
    expect(stub.calls).toHaveLength(0);
  });

  it('Originが欠落していれば403', async () => {
    const stub = stubFetch(hotpepperBody([shop()]));

    const res = await call(searchRequest(validRequest, { origin: null }));

    expect(res.status).toBe(403);
    expect(stub.calls).toHaveLength(0);
  });

  it('CORSヘッダを返さない', async () => {
    stubFetch(hotpepperBody([shop()]));

    const res = await call(searchRequest());

    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

/** HotPepperパラメータ組み立て（BE-001 §7）。 */
describe('HotPepperパラメータ', () => {
  it('固定パラメータを常に付ける', async () => {
    const stub = stubFetch(hotpepperBody([]));

    await call(searchRequest());
    const params = paramsOf(stub);

    expect(params.get('format')).toBe('json');
    expect(params.get('datum')).toBe('world');
    expect(params.get('count')).toBe('50');
    expect(params.get('order')).toBe('4');
  });

  it('APIキーを付ける', async () => {
    const stub = stubFetch(hotpepperBody([]));

    await call(searchRequest());

    expect(paramsOf(stub).get('key')).toBe('test-key');
  });

  it('party_capacity を送らない', async () => {
    const stub = stubFetch(hotpepperBody([]));

    await call(searchRequest());

    expect(paramsOf(stub).has('party_capacity')).toBe(false);
  });

  it('genreCode が null なら genre を送らない', async () => {
    const stub = stubFetch(hotpepperBody([]));

    await call(searchRequest({ ...validRequest, genreCode: null }));

    expect(paramsOf(stub).has('genre')).toBe(false);
  });

  it('genreCode があれば genre を送る', async () => {
    const stub = stubFetch(hotpepperBody([]));

    await call(searchRequest({ ...validRequest, genreCode: 'G012' }));

    expect(paramsOf(stub).get('genre')).toBe('G012');
  });

  it('budgetMax が null なら budget を送らない', async () => {
    const stub = stubFetch(hotpepperBody([]));

    await call(searchRequest({ ...validRequest, budgetMax: null }));

    expect(paramsOf(stub).has('budget')).toBe(false);
  });

  it('budgetMax があれば budget をカンマ区切りで送る', async () => {
    const stub = stubFetch(hotpepperBody([]));

    await call(searchRequest({ ...validRequest, budgetMax: 3000 }));
    const budget = paramsOf(stub).get('budget');

    expect(budget).toBeTruthy();
    expect(budget?.split(',').length).toBeGreaterThan(1);
  });

  it('false のこだわり条件はパラメータを省略する', async () => {
    const stub = stubFetch(hotpepperBody([]));

    await call(
      searchRequest({
        ...validRequest,
        preferences: { privateRoom: false, freeDrink: false, midnight: false },
      }),
    );
    const params = paramsOf(stub);

    expect(params.has('private_room')).toBe(false);
    expect(params.has('free_drink')).toBe(false);
    expect(params.has('midnight')).toBe(false);
  });

  it('true のこだわり条件は 1 を送る', async () => {
    const stub = stubFetch(hotpepperBody([]));

    await call(
      searchRequest({
        ...validRequest,
        preferences: { privateRoom: true, freeDrink: true, midnight: true },
      }),
    );
    const params = paramsOf(stub);

    expect(params.get('private_room')).toBe('1');
    expect(params.get('free_drink')).toBe('1');
    expect(params.get('midnight')).toBe('1');
  });

  it('lat / lng / range / start を渡す', async () => {
    const stub = stubFetch(hotpepperBody([]));

    await call(searchRequest({ ...validRequest, start: 51, range: 2 }));
    const params = paramsOf(stub);

    expect(params.get('lat')).toBe(String(validRequest.lat));
    expect(params.get('lng')).toBe(String(validRequest.lng));
    expect(params.get('range')).toBe('2');
    expect(params.get('start')).toBe('51');
  });
});

/** 正常系（BE-001 §11, §12）。 */
describe('検索結果', () => {
  it('店舗を整形して返す', async () => {
    stubFetch(hotpepperBody([shop(), shop({ id: 'J002', name: 'BAR K' })], { available: 2 }));

    const res = await call(searchRequest());
    const body = (await res.json()) as { shops: { id: string }[] };

    expect(res.status).toBe(200);
    expect(body.shops.map((s) => s.id)).toEqual(['J001', 'J002']);
  });

  it('HotPepperの返却順（おすすめ順）を保持する', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    stubFetch(hotpepperBody(ids.map((id) => shop({ id }))));

    const res = await call(searchRequest());
    const body = (await res.json()) as { shops: { id: string }[] };

    expect(body.shops.map((s) => s.id)).toEqual(ids);
  });

  it('必須項目が欠けた店舗を除外する', async () => {
    stubFetch(hotpepperBody([shop(), shop({ id: undefined }), shop({ id: 'J003' })]));

    const res = await call(searchRequest());
    const body = (await res.json()) as { shops: { id: string }[] };

    expect(body.shops.map((s) => s.id)).toEqual(['J001', 'J003']);
  });

  it('0件でも200で返す', async () => {
    stubFetch(hotpepperBody([], { available: 0, returned: 0 }));

    const res = await call(searchRequest());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      shops: [],
      paging: { nextStart: 1, hasMore: false },
    });
  });
});

/** 外部APIエラー（BE-001 §9, §10）。 */
describe('外部APIエラー', () => {
  const upstreamError = (code: number) => ({ results: { error: [{ code, message: 'x' }] } });

  it.each([1000, 2000, 3000])('results.error code %i は502', async (code) => {
    stubFetch(upstreamError(code));

    const res = await call(searchRequest());

    expect(res.status).toBe(502);
  });

  it('fetchが失敗したら502', async () => {
    stubFetch(() => Promise.reject(new Error('network down')));

    const res = await call(searchRequest());

    expect(res.status).toBe(502);
  });

  it('上流が5xxなら502', async () => {
    stubFetch(() => new Response('', { status: 503 }));

    const res = await call(searchRequest());

    expect(res.status).toBe(502);
  });

  it('タイムアウトは504', async () => {
    stubFetch(() => {
      const error = new Error('timed out');
      error.name = 'TimeoutError';
      return Promise.reject(error);
    });

    const res = await call(searchRequest());

    expect(res.status).toBe(504);
  });

  it('自動リトライしない（fetchは1回だけ）', async () => {
    const stub = stubFetch(() => Promise.reject(new Error('network down')));

    await call(searchRequest());

    expect(stub.calls).toHaveLength(1);
  });

  it('上流のJSONが壊れていたら502', async () => {
    stubFetch(() => new Response('<html>', { status: 200 }));

    const res = await call(searchRequest());

    expect(res.status).toBe(502);
  });
});

/** 入力不正（BE-001 §4）。 */
describe('入力不正', () => {
  it('本文がJSONでなければ400', async () => {
    const stub = stubFetch(hotpepperBody([]));

    const res = await call(searchRequest(undefined, { rawBody: 'not json' }));

    expect(res.status).toBe(400);
    expect(stub.calls).toHaveLength(0);
  });

  it('検証に落ちたら上流を叩かない', async () => {
    const stub = stubFetch(hotpepperBody([]));

    const res = await call(searchRequest({ ...validRequest, range: 9 }));

    expect(res.status).toBe(400);
    expect(stub.calls).toHaveLength(0);
  });
});

/** ログ（BE-001 §18）。 */
describe('ログ', () => {
  it('APIキー・緯度経度を出力しない', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(JSON.stringify(args)));
    vi.spyOn(console, 'error').mockImplementation((...args) => logs.push(JSON.stringify(args)));
    stubFetch(hotpepperBody([shop()]));

    await call(searchRequest());
    const all = logs.join('\n');

    expect(all).not.toContain('test-key');
    expect(all).not.toContain(String(validRequest.lat));
    expect(all).not.toContain(String(validRequest.lng));
  });

  it('店舗名を出力しない', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args) => logs.push(JSON.stringify(args)));
    stubFetch(hotpepperBody([shop()]));

    await call(searchRequest());

    expect(logs.join('\n')).not.toContain('とり吉');
  });

  it('上流エラーのコードを記録する', async () => {
    const logs: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => void logs.push(args));
    stubFetch({ results: { error: [{ code: 2000, message: 'x' }] } });

    await call(searchRequest());

    expect(JSON.stringify(logs)).toContain('"upstreamErrorCode":2000');
  });
});
