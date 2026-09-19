import { errorResponse, HttpError } from './http';
import { UpstreamError } from './hotpepper';
import { handleSearch } from './search';
import type { WorkerEnv } from './env';

/**
 * ルーティングと共通エラー処理（BE-001 §16）。
 *
 * 静的アセットは wrangler.jsonc の run_worker_first により /api/* だけがここへ来る。
 */
export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    const { pathname } = new URL(request.url);

    let response: Response;
    let upstreamErrorCode: number | undefined;

    try {
      response = await route(request, env, pathname);
    } catch (error) {
      if (error instanceof UpstreamError) {
        upstreamErrorCode = error.code;
        response = errorResponse(502, 'upstream error');
      } else if (error instanceof HttpError) {
        response = errorResponse(error.status, error.message);
      } else {
        // 予期しない例外。詳細はクライアントへ返さない
        response = errorResponse(500, 'internal error');
      }
    }

    // 緯度経度・APIキー・検索条件・店舗レスポンス本文は出さない（BE-001 §18）
    const log = {
      requestId,
      path: pathname,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      ...(upstreamErrorCode === undefined ? {} : { upstreamErrorCode }),
    };
    // 2000（キー/IP認証）と3000（パラメータ不正）は自アプリの不具合。500も同様
    if (response.status >= 500) {
      console.error('request failed', log);
    } else {
      console.log('request', log);
    }

    return response;
  },
};

async function route(request: Request, env: WorkerEnv, pathname: string): Promise<Response> {
  if (pathname !== '/api/search') {
    return errorResponse(404, 'not found');
  }

  if (request.method !== 'POST') {
    return errorResponse(405, 'method not allowed');
  }

  assertAllowedOrigin(request, env);

  return handleSearch(request, env);
}

/**
 * 同一オリジンからの利用のみ許可する（BE-001 §5）。
 *
 * APIキー秘匿とは別の目的で、第三者によるHotPepperコール枠の消費を防ぐ。
 * CORSヘッダは返さない。
 */
export function assertAllowedOrigin(request: Request, env: WorkerEnv): void {
  // 静的アセットとAPIは同じWorkerが配信するため、許可すべきOriginは
  // Worker自身のオリジン。未設定ならそれを使い、本番での設定を不要にする。
  // 設定漏れで全リクエストが403になる事故も防げる
  const allowed = env.ALLOWED_ORIGIN || new URL(request.url).origin;

  const origin = request.headers.get('Origin');
  if (origin === null || origin !== allowed) {
    throw new HttpError(403, 'forbidden');
  }
}
