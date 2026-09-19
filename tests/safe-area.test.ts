import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8');

const css = read('src/components/ui.module.css');
const tokens = read('src/tokens.css');

/**
 * セーフエリアの扱いはjsdomではレイアウトが走らず検証できないため、
 * CSSの記述そのものを固定する。
 *
 * 過去に .header が height 固定 + padding-top: env(safe-area-inset-top) で、
 * box-sizing: border-box のもとノッチ端末のPWAで中身が潰れた。
 */
function block(name: string): string {
  const start = css.indexOf(`.${name} {`);
  expect(start, `.${name} が見つかりません`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}

describe('セーフエリア', () => {
  it('トークンとして定義され、0pxのフォールバックがある', () => {
    expect(tokens).toMatch(/--safe-top:\s*env\(safe-area-inset-top,\s*0px\)/);
    expect(tokens).toMatch(/--safe-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/);
  });

  it('ヘッダーは高さを固定しない', () => {
    const header = block('header');

    // height: 58px のような固定指定があると、padding-top が高さを食い潰す
    expect(header).not.toMatch(/(^|[^-])height:\s*\d/m);
  });

  it('ヘッダーはセーフエリアの下に本来の高さを確保する', () => {
    const header = block('header');

    expect(header).toMatch(/min-height:\s*calc\(58px \+ var\(--safe-top\)\)/);
    expect(header).toMatch(/padding-top:\s*var\(--safe-top\)/);
  });

  it('env() を直接使わず、上書きできる変数を経由する', () => {
    // 変数経由にしておくとブラウザで値を差し替えて再現・検証できる
    expect(css).not.toMatch(/env\(safe-area-inset/);
  });
});
