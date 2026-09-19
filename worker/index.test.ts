import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

/** ルーティングと共通エラー処理（BE-001 §15, TEST-001 §4）。 */
describe('routing', () => {
  it('未定義のパスは404を返す', async () => {
    const res = await SELF.fetch('https://tsugidoko.example.com/api/unknown', { method: 'POST' });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'not found' });
  });

  it('/api/search へのGETは405を返す', async () => {
    const res = await SELF.fetch('https://tsugidoko.example.com/api/search');

    expect(res.status).toBe(405);
    await expect(res.json()).resolves.toEqual({ error: 'method not allowed' });
  });

  it('エラー応答はJSONで返る', async () => {
    const res = await SELF.fetch('https://tsugidoko.example.com/api/unknown', { method: 'POST' });

    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
