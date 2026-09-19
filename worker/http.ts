/** JSONレスポンスとエラー応答のヘルパ。 */
import type { ErrorResponse } from '../shared/api-types';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function errorResponse(status: number, message: string): Response {
  return json({ error: message } satisfies ErrorResponse, status);
}

/**
 * ハンドラが投げることでHTTPステータスを決める例外。
 * ルーティング層で一括して捕捉する。
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
