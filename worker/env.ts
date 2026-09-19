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
  /** /api/search を許可するOrigin */
  ALLOWED_ORIGIN: string;
}
