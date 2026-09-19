import { HttpError } from './http';

/**
 * POST /api/search のユースケース。
 *
 * 入力検証・予算コード変換・HotPepper呼出・整形はPR2で実装する（BE-001 §1）。
 */
export async function handleSearch(_request: Request, _env: Env): Promise<Response> {
  throw new HttpError(501, 'not implemented');
}
