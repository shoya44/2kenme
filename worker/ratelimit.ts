import { HttpError } from './http';
import type { WorkerEnv } from './env';

/**
 * IP単位のレート制限（BE-001 §5）。
 *
 * 合言葉の総当たりと、漏れた合言葉によるコール枠の食い潰しを抑える。
 * Cloudflare の Rate Limiting Rules はゾーン（独自ドメイン）の機能で
 * `*.workers.dev` には適用できないため、Worker側のバインディングで行う。
 *
 * バインディングが無い環境（ローカル開発・テスト）では制限しない。
 * 上流保護の仕組みであり、無いことでリクエストを落とす必要はない。
 */
export async function assertWithinRateLimit(request: Request, env: WorkerEnv): Promise<void> {
  const limiter = env.RATE_LIMITER;
  if (!limiter) {
    return;
  }

  // Cloudflare が付与するクライアントIP。取れなければ全体で1つの枠として数える
  const key = request.headers.get('CF-Connecting-IP') ?? 'unknown';

  let success: boolean;
  try {
    ({ success } = await limiter.limit({ key }));
  } catch {
    // 制限側の障害で検索そのものを止めない（開けて倒す）
    console.warn('rate limit unavailable');
    return;
  }

  if (!success) {
    throw new HttpError(429, 'too many requests');
  }
}
