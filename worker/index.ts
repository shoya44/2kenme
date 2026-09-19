import { errorResponse, HttpError } from './http';
import { handleSearch } from './search';

/**
 * ルーティングと共通エラー処理（BE-001 §16）。
 *
 * 静的アセットは wrangler.jsonc の run_worker_first により /api/* だけがここへ来る。
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      if (error instanceof HttpError) {
        return errorResponse(error.status, error.message);
      }
      // 予期しない例外。詳細はクライアントへ返さない
      console.error('unhandled worker error', { name: (error as Error)?.name });
      return errorResponse(500, 'internal error');
    }
  },
};

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === '/api/search') {
    if (request.method !== 'POST') {
      return errorResponse(405, 'method not allowed');
    }
    return handleSearch(request, env);
  }

  return errorResponse(404, 'not found');
}
