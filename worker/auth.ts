import { HttpError } from './http';
import type { WorkerEnv } from './env';

/** 合言葉を載せるヘッダ（BE-001 §5）。 */
export const APP_TOKEN_HEADER = 'X-App-Token';

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
