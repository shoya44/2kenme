import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import {
  DEFAULT_CONDITION,
  GEO_TTL_MS,
  RESUME_WINDOW_MS,
  savePasscode,
  STORAGE_KEYS,
} from './services/storage';
import type { SearchResponse, Shop } from '../shared/api-types';

/**
 * 深夜帯の既定ON（`utils/latenight`）は端末時刻を見るため、テストでは固定する。
 * 既定は深夜帯ではない時刻。深夜帯の挙動は専用のテストで `clock.now` を差し替える。
 */
const clock = vi.hoisted(() => ({ now: new Date(2026, 8, 22, 19, 0, 0) }));

vi.mock('./utils/latenight', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils/latenight')>();
  return {
    ...actual,
    isLateNight: (now?: Date) => actual.isLateNight(now ?? clock.now),
    withLateNightDefault: (
      condition: Parameters<typeof actual.withLateNightDefault>[0],
      now?: Date,
    ) => actual.withLateNightDefault(condition, now ?? clock.now),
  };
});

const shop = (id: string, overrides: Partial<Shop> = {}): Shop => ({
  id,
  name: `店 ${id}`,
  photoUrl: null,
  hotpepperUrl: `https://www.hotpepper.jp/str${id}/`,
  budgetText: '3001～4000円',
  walkMinutes: 4,
  openText: null,
  closedText: null,
  ...overrides,
});

function response(shops: Shop[], hasMore = false): SearchResponse {
  return { shops, paging: { nextStart: shops.length + 1, hasMore } };
}

/** 位置情報を許可した状態にする。 */
function allowGeolocation(coords = { latitude: 35.69, longitude: 139.7 }) {
  const getCurrentPosition = vi.fn((success: PositionCallback) => {
    success({ coords, timestamp: Date.now() } as GeolocationPosition);
  });
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });
  return getCurrentPosition;
}

function denyGeolocation() {
  const getCurrentPosition = vi.fn((_s: PositionCallback, error?: PositionErrorCallback) => {
    error?.({ code: 1, message: 'denied' } as GeolocationPositionError);
  });
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });
  return getCurrentPosition;
}

function stubSearch(...responses: SearchResponse[]) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    const body = responses.length > 1 ? responses.shift() : responses[0];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function search(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'さがす' }));
}

const PASSCODE = 'test-passcode';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clock.now = new Date(2026, 8, 22, 19, 0, 0);
  // 合言葉は入力済みの端末を既定とする。入力の流れは専用のテストで見る
  savePasscode(PASSCODE);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** トップ画面（FE-001 §4 / TEST-001 §5）。 */
describe('トップ画面', () => {
  it('アプリ名を表示する', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'つぎどこ' })).toBeInTheDocument();
  });

  it('深夜帯は「23時以降営業」がONになり、その旨を表示する', async () => {
    const user = userEvent.setup();
    clock.now = new Date(2026, 8, 22, 23, 30, 0);
    render(<App />);

    expect(screen.getByText(/深夜帯のため「23時以降営業」をONにしています/)).toBeInTheDocument();

    await user.click(screen.getByText('こだわり'));
    expect(screen.getByRole('checkbox', { name: '23時以降営業' })).toBeChecked();
  });

  it('深夜帯でなければ「23時以降営業」はOFFのまま', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByText(/深夜帯のため/)).toBeNull();

    await user.click(screen.getByText('こだわり'));
    expect(screen.getByRole('checkbox', { name: '23時以降営業' })).not.toBeChecked();
  });

  it('深夜帯の既定ONは外せる', async () => {
    const user = userEvent.setup();
    clock.now = new Date(2026, 8, 23, 1, 0, 0);
    render(<App />);
    await user.click(screen.getByText('こだわり'));

    await user.click(screen.getByRole('checkbox', { name: '23時以降営業' }));

    expect(screen.getByRole('checkbox', { name: '23時以降営業' })).not.toBeChecked();
    expect(screen.queryByText(/深夜帯のため/)).toBeNull();
  });

  it('「人数」ステッパーが存在しない', () => {
    render(<App />);

    expect(screen.queryByText('人数')).toBeNull();
  });

  it('予算スライダーが離散値で、aria-valuetext が表示ラベルと一致する', () => {
    render(<App />);
    const slider = screen.getByRole('slider', { name: '予算' });

    expect(slider).toHaveAttribute('aria-valuetext', '4,000円以内');

    fireEvent.change(slider, { target: { value: '3' } });

    expect(slider).toHaveAttribute('aria-valuetext', '5,000円以内');
  });

  it('距離スライダーが4段階', () => {
    render(<App />);
    const slider = screen.getByRole('slider', { name: '距離' });

    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '3');
  });

  it('ジャンルチップが単一選択で、選択中に aria-pressed が付く', async () => {
    const user = userEvent.setup();
    render(<App />);

    const izakaya = screen.getByRole('button', { name: '居酒屋' });
    const bar = screen.getByRole('button', { name: 'バー・カクテル' });

    await user.click(izakaya);
    expect(izakaya).toHaveAttribute('aria-pressed', 'true');

    await user.click(bar);
    expect(izakaya).toHaveAttribute('aria-pressed', 'false');
    expect(bar).toHaveAttribute('aria-pressed', 'true');
  });

  it('ジャンルは「焼き鳥」を持たない（ジャンルマスタ準拠）', () => {
    render(<App />);

    expect(screen.queryByRole('button', { name: '焼き鳥' })).toBeNull();
  });

  it('こだわりを開閉でき、選択件数を表示する', async () => {
    const user = userEvent.setup();
    render(<App />);
    const details = screen.getByText('こだわり').closest('details');
    if (!details) {
      throw new Error('こだわりのAccordionが見つかりません');
    }

    expect(within(details).getByText('指定なし')).toBeInTheDocument();

    await user.click(screen.getByText('こだわり'));
    await user.click(screen.getByLabelText('個室'));

    expect(within(details).getByText('1件選択')).toBeInTheDocument();
  });

  it('「さがす」直上に検索範囲を表示する', () => {
    render(<App />);

    expect(screen.getByText(/現在地から半径1km以内でさがします/)).toBeInTheDocument();
  });

  it('予算未登録を含めるトグルがあり、既定でオン', () => {
    render(<App />);

    expect(screen.getByLabelText('予算未登録の店も含める')).toBeChecked();
  });

  it('予算「指定なし」ではトグルを無効にする（意味を持たないため）', async () => {
    const user = userEvent.setup();
    render(<App />);
    const slider = screen.getByRole('slider', { name: '予算' });

    // 右端＝指定なし
    fireEvent.change(slider, { target: { value: '6' } });

    expect(slider).toHaveAttribute('aria-valuetext', '指定なし');
    expect(screen.getByLabelText('予算未登録の店も含める')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'おまかせ' }));
  });

  it('トグルの状態をAPIへ渡す', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    const fetchMock = stubSearch(response([shop('a')]));
    render(<App />);

    await user.click(screen.getByLabelText('予算未登録の店も含める'));
    await search(user);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.includeUnknownBudget).toBe(false);
  });

  it('HotPepperクレジットを表示する', () => {
    render(<App />);

    expect(screen.getByText(/ホットペッパーグルメ Webサービス/)).toBeInTheDocument();
  });
});

/** 検索とNG / OK（FE-001 §12, §13）。 */
describe('検索', () => {
  it('結果は1店舗だけ表示される', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a'), shop('b'), shop('c')]));
    render(<App />);

    await search(user);

    await waitFor(() => expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument());
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
  });

  it('ページ単位で候補が全滅しても、続きがあれば自動で次ページを提示する', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    // 1ページ目はB/Eの予算絞り込みで全滅。2ページ目に候補が残っている状況
    stubSearch({ shops: [], paging: { nextStart: 51, hasMore: true } }, response([shop('a')]));
    render(<App />);

    await search(user);

    await waitFor(() => expect(screen.getByRole('heading', { name: '店 a' })).toBeInTheDocument());
    expect(screen.queryByText('候補が見つかりませんでした')).toBeNull();
  });

  it('営業時間・定休日を表示する（営業中の判定はしない）', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a', { openText: '月～日: 17:00～翌2:00', closedText: '日曜日' })]));
    render(<App />);

    await search(user);

    await waitFor(() => expect(screen.getByText('営業時間')).toBeInTheDocument());
    expect(screen.getByText('月～日: 17:00～翌2:00')).toBeInTheDocument();
    expect(screen.getByText('定休日')).toBeInTheDocument();
    expect(screen.getByText('日曜日')).toBeInTheDocument();
    expect(screen.queryByText(/営業中/)).toBeNull();
  });

  it('営業時間が無い店舗はその行を出さない', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a')]));
    render(<App />);

    await search(user);

    await waitFor(() => expect(screen.getByRole('heading', { name: '店 a' })).toBeInTheDocument());
    expect(screen.queryByText('営業時間')).toBeNull();
    expect(screen.queryByText('定休日')).toBeNull();
  });

  it('徒歩時間が無い店舗は徒歩の行を出さない', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a', { walkMinutes: null })]));
    render(<App />);

    await search(user);

    await waitFor(() => expect(screen.getByRole('heading', { name: '店 a' })).toBeInTheDocument());
    expect(screen.queryByText(/徒歩 約/)).toBeNull();
  });

  it('予算が無い店舗は予算の行を出さない', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a', { budgetText: null })]));
    render(<App />);

    await search(user);

    await waitFor(() => expect(screen.getByRole('heading', { name: '店 a' })).toBeInTheDocument());
    expect(screen.queryByText('予算情報なし')).toBeNull();
  });

  it('鮮度切れの現在地は使わず、取り直す', async () => {
    const user = userEvent.setup();
    const getCurrentPosition = allowGeolocation();
    stubSearch(response([shop('a')]));
    // 前回の検索で取得した現在地が鮮度切れになっている状況
    sessionStorage.setItem(
      'tsugidoko:geo',
      JSON.stringify({ lat: 35.0, lng: 139.0, acquiredAt: Date.now() - GEO_TTL_MS - 1 }),
    );
    render(<App />);

    await search(user);

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
  });

  it('現在地は「さがす」押下時に取得する', async () => {
    const user = userEvent.setup();
    const getCurrentPosition = allowGeolocation();
    stubSearch(response([shop('a')]));
    render(<App />);

    expect(getCurrentPosition).not.toHaveBeenCalled();

    await search(user);
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
  });

  it('NGで別の店舗が表示される', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a'), shop('b')]));
    render(<App />);
    await search(user);
    await waitFor(() => expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument());

    const before = screen.getByRole('heading', { level: 2 }).textContent;
    await user.click(screen.getByRole('button', { name: /NG/ }));

    expect(screen.getByRole('heading', { level: 2 }).textContent).not.toBe(before);
  });

  it('OKボタンは a 要素で、新しいタブを開く', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a')]));
    render(<App />);
    await search(user);
    await waitFor(() => expect(screen.getByRole('link', { name: /OK/ })).toBeInTheDocument());

    const ok = screen.getByRole('link', { name: /OK/ });

    expect(ok).toHaveAttribute('href', 'https://www.hotpepper.jp/stra/');
    expect(ok).toHaveAttribute('target', '_blank');
    expect(ok).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('OKで履歴に保存される', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a')]));
    render(<App />);
    await search(user);
    await waitFor(() => expect(screen.getByRole('link', { name: /OK/ })).toBeInTheDocument());

    await user.click(screen.getByRole('link', { name: /OK/ }));

    expect(localStorage.getItem('tsugidoko:history')).toContain('店 a');
  });

  it('結果画面に検索範囲を表示する', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a')]));
    render(<App />);
    await search(user);

    await waitFor(() => expect(screen.getByText('現在地から半径1km以内')).toBeInTheDocument());
  });

  it('通信中は「さがす」を連打できない', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    let resolve: ((r: Response) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    const button = screen.getByRole('button', { name: 'さがす' });
    await user.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: '検索中…' })).toBeDisabled();

    resolve?.(new Response(JSON.stringify(response([shop('a')])), { status: 200 }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});

/** iPhoneでの体感（FE-001 §20, §33）。 */
describe('結果画面の体感', () => {
  it('結果画面へ移るとスクロール位置を先頭へ戻す', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a')]));
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<App />);
    scrollTo.mockClear();

    await search(user);

    await waitFor(() => expect(screen.getByRole('heading', { name: '店 a' })).toBeInTheDocument());
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('次候補の写真を先読みする', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(
      response([
        shop('a', { photoUrl: 'https://example.com/a.jpg' }),
        shop('b', { photoUrl: 'https://example.com/b.jpg' }),
      ]),
    );
    const loaded: string[] = [];
    class FakeImage {
      set src(value: string) {
        loaded.push(value);
      }
    }
    vi.stubGlobal('Image', FakeImage);
    render(<App />);

    await search(user);

    await waitFor(() => expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument());
    // 表示中の店は img 要素で読むので、先読みするのは queue 先頭の1枚
    const shown = screen.getByRole('heading', { level: 2 }).textContent;
    const nextPhoto = shown === '店 a' ? 'https://example.com/b.jpg' : 'https://example.com/a.jpg';
    expect(loaded).toEqual([nextPhoto]);
  });

  it('表示中の写真は遅延読み込みしない', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a', { photoUrl: 'https://example.com/a.jpg' })]));
    render(<App />);

    await search(user);

    await waitFor(() => expect(screen.getByRole('heading', { name: '店 a' })).toBeInTheDocument());
    const img = document.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://example.com/a.jpg');
    expect(img).not.toHaveAttribute('loading', 'lazy');
  });

  it('共有できる端末では、店名とURLを共有シートへ渡す', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a')]));
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, share });
    render(<App />);
    await search(user);
    await waitFor(() => expect(screen.getByRole('heading', { name: '店 a' })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'みんなに共有' }));

    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ title: '店 a', url: 'https://www.hotpepper.jp/stra/' }),
    );
  });

  it('共有できない端末では共有の導線を出さない', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a')]));
    render(<App />);
    await search(user);
    await waitFor(() => expect(screen.getByRole('heading', { name: '店 a' })).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'みんなに共有' })).toBeNull();
  });
});

/** 候補なしと条件緩和（FE-001 §14, §15）。 */
describe('候補なし', () => {
  it('0件で候補なしを表示する', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([]));
    render(<App />);
    await search(user);

    await waitFor(() => expect(screen.getByText('候補が見つかりませんでした')).toBeInTheDocument());
  });

  it('候補を出し切っても候補なしを表示する', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a')]));
    render(<App />);
    await search(user);
    await waitFor(() => expect(screen.getByRole('button', { name: /NG/ })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /NG/ }));

    expect(screen.getByText('候補が見つかりませんでした')).toBeInTheDocument();
  });

  it('こだわり未設定なら「こだわりを外す」は提案しない（条件が変わらないため）', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([]));
    render(<App />);
    await search(user);
    await waitFor(() => expect(screen.getByText('候補が見つかりませんでした')).toBeInTheDocument());

    // 初期条件はこだわり未設定・ジャンルおまかせなので、次は距離の拡大になる
    expect(screen.queryByRole('button', { name: 'こだわり条件を外してさがす' })).toBeNull();
    expect(screen.getByRole('button', { name: 'もう少し広い範囲でさがす' })).toBeInTheDocument();
  });

  it('こだわりを設定していれば、それを外す提案が出る', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([]));
    render(<App />);
    await user.click(screen.getByText('こだわり'));
    await user.click(screen.getByLabelText('個室'));
    await search(user);
    await waitFor(() => expect(screen.getByText('候補が見つかりませんでした')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'こだわり条件を外してさがす' })).toBeInTheDocument();
  });

  it('緩和CTAを押すと再検索し、緩和内容を表示する', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([]), response([shop('a')]));
    render(<App />);
    await search(user);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'もう少し広い範囲でさがす' })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'もう少し広い範囲でさがす' }));

    await waitFor(() => expect(screen.getByText('範囲を広げて再検索しました')).toBeInTheDocument());
  });

  it('候補なし画面に、実際に検索した条件を表示する', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([]));
    render(<App />);
    await search(user);

    await waitFor(() =>
      expect(
        screen.getByText(/4,000円以内 \/ おまかせ \/ 1km以内 \/ こだわりなし/),
      ).toBeInTheDocument(),
    );
  });

  it('緩和後は、緩和を反映した条件を表示する', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([]), response([shop('a')]));
    render(<App />);
    await search(user);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'もう少し広い範囲でさがす' })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'もう少し広い範囲でさがす' }));

    // 距離が 1km → 2km になったことが条件表示に出る
    await waitFor(() =>
      expect(
        screen.getByText('4,000円以内 / おまかせ / 2km以内 / こだわりなし'),
      ).toBeInTheDocument(),
    );
  });
});

/** エラー（FE-001 §28）。 */
describe('エラー', () => {
  it('位置情報を拒否すると再試行CTAが出る', async () => {
    const user = userEvent.setup();
    denyGeolocation();
    stubSearch(response([shop('a')]));
    render(<App />);

    await search(user);

    await waitFor(() =>
      expect(screen.getByText('現在地を取得できませんでした')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument();
  });

  it('オフラインなら、その旨を添える', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    render(<App />);

    await search(user);

    await waitFor(() => expect(screen.getByText(/オフラインのようです/)).toBeInTheDocument());
  });

  it('通信に失敗すると再試行CTAが出る', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    render(<App />);

    await search(user);

    await waitFor(() => expect(screen.getByText('店舗を取得できませんでした')).toBeInTheDocument());
  });
});

/** 合言葉（FE-001 §29 / BE-001 §5）。 */
describe('合言葉', () => {
  it('未入力なら入力画面を出し、条件設定は見せない', () => {
    localStorage.clear();

    render(<App />);

    expect(screen.getByLabelText('合言葉')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'さがす' })).toBeNull();
  });

  it('入力すると保存され、次回は聞かれない', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    const { unmount } = render(<App />);

    await user.type(screen.getByLabelText('合言葉'), PASSCODE);
    await user.click(screen.getByRole('button', { name: 'はじめる' }));

    expect(screen.getByRole('button', { name: 'さがす' })).toBeInTheDocument();
    unmount();

    render(<App />);
    expect(screen.getByRole('button', { name: 'さがす' })).toBeInTheDocument();
  });

  it('空のままでは進めない', () => {
    localStorage.clear();

    render(<App />);

    expect(screen.getByRole('button', { name: 'はじめる' })).toBeDisabled();
  });

  it('検索リクエストに合言葉を載せる', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    const fetchMock = stubSearch(response([shop('a')]));
    render(<App />);

    await search(user);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>)['X-App-Token']).toBe(PASSCODE);
  });

  it('403なら保存済みの合言葉を捨てて入力画面へ戻す', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{"error":"forbidden"}', { status: 403 }))),
    );
    render(<App />);

    await search(user);

    await waitFor(() => expect(screen.getByText('合言葉が違います')).toBeInTheDocument());
    expect(localStorage.getItem(STORAGE_KEYS.passcode)).toBeNull();
  });

  it('403以外のエラーでは合言葉を捨てない', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{"error":"upstream"}', { status: 502 }))),
    );
    render(<App />);

    await search(user);

    await waitFor(() => expect(screen.getByText('店舗を取得できませんでした')).toBeInTheDocument());
    expect(localStorage.getItem(STORAGE_KEYS.passcode)).not.toBeNull();
  });
});

/** 起動時の現在地取得（FE-001 §21）。 */
describe('現在地の先出し', () => {
  it('許可実績があれば起動時に取得する', async () => {
    const getCurrentPosition = allowGeolocation();
    localStorage.setItem('tsugidoko:geo-granted', 'true');

    render(<App />);

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
  });

  it('許可実績が無ければ起動時に取得しない', async () => {
    const getCurrentPosition = allowGeolocation();

    render(<App />);

    // 先出しは非同期。1フレーム待っても呼ばれないことを見る
    await waitFor(() => expect(screen.getByRole('button', { name: 'さがす' })).toBeEnabled());
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('起動時の取得に失敗してもエラーを表示しない', async () => {
    const getCurrentPosition = denyGeolocation();
    localStorage.setItem('tsugidoko:geo-granted', 'true');

    render(<App />);

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('現在地を取得できませんでした')).toBeNull();
  });

  it('先出しできていれば「さがす」で取得し直さない', async () => {
    const user = userEvent.setup();
    const getCurrentPosition = allowGeolocation();
    localStorage.setItem('tsugidoko:geo-granted', 'true');
    stubSearch(response([shop('a')]));
    render(<App />);
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));

    await search(user);

    await waitFor(() => expect(screen.getByRole('heading', { name: '店 a' })).toBeInTheDocument());
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });
});

/** ヘッダー（FE-001 §3）。 */
describe('ヘッダー', () => {
  it('アプリ名をタップすると結果画面からトップへ戻る', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a')]));
    render(<App />);
    await search(user);
    await waitFor(() => expect(screen.getByRole('button', { name: /NG/ })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'つぎどこ' }));

    expect(screen.getByRole('button', { name: 'さがす' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /NG/ })).toBeNull();
  });

  it('トップへ戻っても条件を保つ', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    stubSearch(response([shop('a')]));
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'ラーメン' }));
    await search(user);
    await waitFor(() => expect(screen.getByRole('button', { name: /NG/ })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'つぎどこ' }));

    expect(screen.getByRole('button', { name: 'ラーメン' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('見出しとしての意味を保つ', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('つぎどこ');
  });
});

/** 履歴シート（FE-001 §24 / DATA-001 §10）。 */
describe('履歴シート', () => {
  it('メニューから開ける', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'メニュー' }));
    await user.click(screen.getByRole('button', { name: '履歴' }));

    expect(screen.getByRole('dialog', { name: '履歴' })).toBeInTheDocument();
  });

  it('サムネイル画像を表示しない', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'tsugidoko:history',
      JSON.stringify([
        {
          shopId: 'a',
          name: '店 a',
          hotpepperUrl: 'https://www.hotpepper.jp/stra/',
          budgetText: '3001～4000円',
          walkMinutes: 4,
          decidedAt: Date.now(),
        },
      ]),
    );
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'メニュー' }));
    await user.click(screen.getByRole('button', { name: '履歴' }));
    const dialog = screen.getByRole('dialog', { name: '履歴' });

    expect(within(dialog).queryByRole('img')).toBeNull();
    expect(within(dialog).getByText('店 a')).toBeInTheDocument();
  });

  it('徒歩時間が無い履歴は徒歩の表記を出さない', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'tsugidoko:history',
      JSON.stringify([
        {
          shopId: 'a',
          name: '店 a',
          hotpepperUrl: 'https://www.hotpepper.jp/stra/',
          budgetText: '3001～4000円',
          walkMinutes: null,
          decidedAt: Date.now(),
        },
      ]),
    );
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'メニュー' }));
    await user.click(screen.getByRole('button', { name: '履歴' }));
    const dialog = screen.getByRole('dialog', { name: '履歴' });

    expect(within(dialog).queryByText(/徒歩/)).toBeNull();
    expect(within(dialog).getByText('3001～4000円')).toBeInTheDocument();
  });

  it('クレジットを表示する', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'メニュー' }));
    await user.click(screen.getByRole('button', { name: '履歴' }));
    const dialog = screen.getByRole('dialog', { name: '履歴' });

    expect(within(dialog).getByText(/ホットペッパーグルメ Webサービス/)).toBeInTheDocument();
  });
});

/** 前回条件の復元（REQ-001 F-08）。 */
describe('復元', () => {
  it('前回条件を復元する', () => {
    localStorage.setItem(
      'tsugidoko:defaults',
      JSON.stringify({
        budgetMax: 2000,
        genreCode: 'G013',
        preferences: { privateRoom: false, freeDrink: false, midnight: false },
        range: 1,
      }),
    );

    render(<App />);

    expect(screen.getByRole('slider', { name: '予算' })).toHaveAttribute(
      'aria-valuetext',
      '2,000円以内',
    );
    expect(screen.getByRole('button', { name: 'ラーメン' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

/** セッション復帰（DATA-001 §2 / FE-001 §23）。 */
describe('セッション復帰', () => {
  /** 現在地を持たない復帰直後の状態を作る。 */
  function seedSession(shops: Shop[], hasMore: boolean, lastActiveAt = Date.now()) {
    localStorage.setItem(
      'tsugidoko:session',
      JSON.stringify({
        condition: {
          budgetMax: 4000,
          genreCode: null,
          preferences: { privateRoom: false, freeDrink: false, midnight: false },
          range: 3,
        },
        relaxLevel: 0,
        currentShop: shops[0],
        queue: shops.slice(1),
        shownIds: [],
        nextStart: 51,
        hasMore,
        startedAt: Date.now(),
        lastActiveAt,
      }),
    );
  }

  it('結果画面から再開する', () => {
    seedSession([shop('a'), shop('b')], false);

    render(<App />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('店 a');
  });

  it('離脱から猶予を過ぎていればトップ画面から始める', () => {
    seedSession([shop('a'), shop('b')], false, Date.now() - RESUME_WINDOW_MS - 1);

    render(<App />);

    expect(screen.getByRole('button', { name: 'さがす' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /NG/ })).toBeNull();
  });

  it('トップ画面から始めるとき、前回のNG履歴も残さない', async () => {
    const user = userEvent.setup();
    allowGeolocation();
    // 前回 店a をNGして離脱し、猶予を過ぎてから開き直した
    localStorage.setItem(
      'tsugidoko:session',
      JSON.stringify({
        condition: DEFAULT_CONDITION,
        relaxLevel: 0,
        currentShop: null,
        queue: [],
        shownIds: ['a'],
        nextStart: 51,
        hasMore: false,
        startedAt: Date.now(),
        lastActiveAt: Date.now() - RESUME_WINDOW_MS - 1,
      }),
    );
    stubSearch(response([shop('a')]));
    render(<App />);

    await search(user);

    // 捨てているので、前回NGした店がまた出る
    await waitFor(() => expect(screen.getByRole('heading', { name: '店 a' })).toBeInTheDocument());
  });

  it('復帰後の追加取得で現在地を取り直す', async () => {
    const user = userEvent.setup();
    // 現在地はsessionStorageに無い状態で復帰する
    seedSession([shop('a')], true);
    const getCurrentPosition = allowGeolocation();
    const fetchMock = stubSearch(response([shop('b'), shop('c')], false));
    render(<App />);

    // queueが空になり先読みが必要になる
    await user.click(screen.getByRole('button', { name: /NG/ }));

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/店 [bc]/),
    );
  });

  it('復帰後に現在地を取得できなければエラーを出す（無限ローディングにしない）', async () => {
    const user = userEvent.setup();
    seedSession([shop('a')], true);
    const getCurrentPosition = denyGeolocation();
    stubSearch(response([shop('b')], false));
    render(<App />);

    await user.click(screen.getByRole('button', { name: /NG/ }));

    await waitFor(() =>
      expect(screen.getByText('現在地を取得できませんでした')).toBeInTheDocument(),
    );
    // 復帰直後の先読みとNG後の先読みで1回ずつ。失敗 → 即再試行 は繰り返さない
    const calls = getCurrentPosition.mock.calls.length;
    await new Promise((r) => setTimeout(r, 100));
    expect(getCurrentPosition).toHaveBeenCalledTimes(calls);
    expect(calls).toBeLessThanOrEqual(2);
  });

  it('先読みに失敗しても、表示中の店を残したまま再試行を繰り返さない', async () => {
    seedSession([shop('a'), shop('b')], true);
    sessionStorage.setItem(
      'tsugidoko:geo',
      JSON.stringify({ lat: 35.69, lng: 139.7, acquiredAt: Date.now() }),
    );
    const fetchMock = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 100));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: '店 a' })).toBeInTheDocument();
    expect(screen.queryByText('店舗を取得できませんでした')).toBeNull();
  });

  it('先読みの失敗後、NGすると改めて先読みを試みる', async () => {
    const user = userEvent.setup();
    seedSession([shop('a'), shop('b')], true);
    sessionStorage.setItem(
      'tsugidoko:geo',
      JSON.stringify({ lat: 35.69, lng: 139.7, acquiredAt: Date.now() }),
    );
    const fetchMock = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /NG/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('heading', { name: '店 b' })).toBeInTheDocument();
  });
});

/** このアプリについて（FE-001 §5 メニュー）。 */
describe('このアプリについて', () => {
  it('メニューから開ける', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'メニュー' }));
    await user.click(screen.getByRole('button', { name: 'このアプリについて' }));

    const dialog = screen.getByRole('dialog', { name: 'このアプリについて' });

    expect(within(dialog).getByText('2軒目を、1軒だけ。')).toBeInTheDocument();
    expect(within(dialog).getByText(/ホットペッパーグルメ Webサービス/)).toBeInTheDocument();
  });
});
