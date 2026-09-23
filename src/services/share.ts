import type { Shop } from '../types';

/**
 * Web Share API が使えるか。
 *
 * iOS Safari / Android Chrome の共有シートに載せる。使えない環境では
 * 導線ごと出さない。クリップボードへの代替は行わない（何が起きたか分かりにくいため）。
 */
export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * 提示中の店を共有シートへ渡す。
 *
 * 2軒目は一緒にいる人と決めるので、店名とHotPepperのURLをそのまま送れるようにする。
 * ユーザーがシートを閉じた場合（AbortError）は何もしない。
 */
export async function shareShop(shop: Shop): Promise<void> {
  try {
    await navigator.share({ title: shop.name, text: shop.name, url: shop.hotpepperUrl });
  } catch {
    // キャンセル・未対応データ。画面には出さない
  }
}
