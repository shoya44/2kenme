import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * Worker は実runtime（workerd）上でテストする。
 * Node環境のエミュレーションではCloudflare固有の挙動を検証できないため（TEST-001 §2）。
 */
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          // テスト用のダミー値。実キーは使わない
          HOTPEPPER_API_KEY: 'test-key',
          ALLOWED_ORIGIN: 'https://tsugidoko.example.com',
          APP_PASSCODE: 'test-passcode',
        },
      },
    }),
  ],
  test: {
    include: ['worker/**/*.test.ts'],
  },
});
