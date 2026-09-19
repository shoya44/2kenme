// モック画像の再生成: node shot.mjs [出力先ディレクトリ]
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? here;

const screens = {
  s1: '01_トップ画面',
  s2: '02_結果画面',
  s3: '03_候補なし',
  s4: '04_履歴シート',
};

const browser = await chromium.launch();
const page = await browser.newPage({
  deviceScaleFactor: 2,
  viewport: { width: 1000, height: 1000 },
});

await page.goto('file://' + join(here, 'mock.html'), { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

for (const [id, name] of Object.entries(screens)) {
  await page.locator('#' + id).screenshot({ path: join(out, `${name}.png`) });
  console.log('shot', name);
}

await browser.close();
