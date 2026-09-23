import { HttpError } from './http';
import { APP_TOKEN_HEADER } from '../shared/api-types';
import type { WorkerEnv } from './env';

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

/**
 * 許可された利用者だけに `/api/search` を使わせる（BE-001 §5）。
 *
 * Origin検証はブラウザ以外からのリクエストには効かない（ヘッダを自由に付けられる）ため、
 * HotPepperのコール枠を守る主たる手段はこの合言葉とレート制限にする。
 *
 * 合言葉は端末に平文で残る共有秘密であり、漏れたら差し替える前提で扱う。
 */
export function assertPasscode(request: Request, env: WorkerEnv): void {
  // Secret の登録漏れで「誰でも使える」状態にはしない。設定不備として落とす
  if (!env.APP_PASSCODE) {
    throw new HttpError(500, 'not configured');
  }

  const provided = request.headers.get(APP_TOKEN_HEADER);
  if (provided === null || !isEqual(provided, env.APP_PASSCODE)) {
    throw new HttpError(403, 'forbidden');
  }
}

/**
 * 文字列を定数時間で比較する。
 *
 * 長さの違いは漏れるが、合言葉の中身が1文字ずつ特定されることを防ぐ。
 */
function isEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);

  if (left.byteLength !== right.byteLength) {
    return false;
  }
  return crypto.subtle.timingSafeEqual(left, right);
}
