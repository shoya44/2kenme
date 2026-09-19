import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import type { SearchResponse, Shop } from '../shared/api-types';

const shop = (id: string, overrides: Partial<Shop> = {}): Shop => ({
  id,
  name: `店 ${id}`,
  photoUrl: null,
  hotpepperUrl: `https://www.hotpepper.jp/str${id}/`,
  budgetText: '3001～4000円',
  walkMinutes: 4,
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

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
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
  function seedSession(shops: Shop[], hasMore: boolean) {
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
      }),
    );
  }

  it('結果画面から再開する', () => {
    seedSession([shop('a'), shop('b')], false);

    render(<App />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('店 a');
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
    denyGeolocation();
    stubSearch(response([shop('b')], false));
    render(<App />);

    await user.click(screen.getByRole('button', { name: /NG/ }));

    await waitFor(() =>
      expect(screen.getByText('現在地を取得できませんでした')).toBeInTheDocument(),
    );
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
