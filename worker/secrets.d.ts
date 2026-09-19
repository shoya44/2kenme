/**
 * Secret のバインディング型。
 *
 * wrangler.jsonc の vars は `wrangler types` が worker-configuration.d.ts へ
 * グローバルの `Env` として生成するが、Secret は設定ファイルに現れない。
 * ここで宣言マージして補う（BE-001 §20）。
 */

interface Env {
  /** HotPepper APIキー */
  HOTPEPPER_API_KEY: string;
}
