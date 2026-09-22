/**
 * Worker のバインディング（BE-001 §20）。
 *
 * `wrangler types` が生成する `Env` は wrangler.jsonc の vars を
 * リテラル型で書き出すうえ、Secret を含まない。
 * コードからはこの interface を使う。
 */
export interface WorkerEnv {
  /** HotPepper APIキー。Cloudflare Secret */
  HOTPEPPER_API_KEY: string;
  /**
   * /api/search を許可するOrigin。
   *
   * 未設定なら Worker 自身のオリジンを使う。静的アセットと API は
   * 同じ Worker が配信するため、本番では設定不要（BE-001 §5）。
   * F/Eとは別オリジンで動かす開発時だけ指定する。
   */
  ALLOWED_ORIGIN?: string;
  /**
   * 利用者を絞るための合言葉。Cloudflare Secret（BE-001 §5）。
   *
   * 未設定なら `/api/search` は 500 を返す。登録漏れで「誰でも使える」
   * 状態にしないため。ローカルは `.dev.vars` で与える。
   */
  APP_PASSCODE?: string;
  /**
   * IP単位のレート制限（BE-001 §5）。
   *
   * `wrangler.jsonc` の unsafe バインディングで与える。
   * ローカル開発・テストでは未バインドで、その場合は制限しない。
   */
  RATE_LIMITER?: RateLimit;
  /**
   * HotPepperのエンドポイントを差し替える（開発時のみ）。
   * 未設定なら本番のエンドポイントを使う。
   */
  HOTPEPPER_ENDPOINT?: string;
}
