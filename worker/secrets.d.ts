/**
 * Secret のバインディング型。
 *
 * wrangler.jsonc の vars は `wrangler types` が worker-configuration.d.ts へ生成するが、
 * Secret は設定ファイルに現れないためここで宣言し、生成された Cloudflare.Env へマージする。
 */
declare namespace Cloudflare {
  interface Env {
    /** HotPepper APIキー（BE-001 §20） */
    HOTPEPPER_API_KEY: string;
  }
}
