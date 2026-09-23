/**
 * F/E と Worker で共有する API I/F 型（BAS-001 §11 / BE-001 §3, §11）。
 *
 * HotPepper固有のコード体系（予算コード等）はWorker側に閉じ込め、ここには持ち込まない。
 */

/** 1人あたりの予算上限（円）。UIの離散スライダーが取り得る値（REQ-001 §6.1） */
export const BUDGET_MAX_OPTIONS = [2000, 3000, 4000, 5000, 7000, 10000] as const;

/** 予算上限。null は上限なし（「指定なし」） */
export type BudgetMax = (typeof BUDGET_MAX_OPTIONS)[number] | null;

/** HotPepperのジャンルマスタ（大ジャンル）のうち本アプリで扱うもの（REQ-001 §6.2） */
export const GENRE_CODES = ['G001', 'G002', 'G012', 'G013', 'G014'] as const;

/** ジャンルコード。null は「おまかせ」 */
export type GenreCode = (typeof GENRE_CODES)[number] | null;

/**
 * HotPepperのページング開始位置の上限（BE-001 §4）。
 *
 * 1ページ50件で最大5ページ（250件）までを1検索の探索範囲とする。
 * 上限を置かないと、B/Eの予算絞り込みで候補が落ちたときの自動ページ送りが
 * 際限なく上流を叩き、コール枠を消費する。
 */
export const MAX_START = 201;

/** 検索範囲。1=300m / 2=500m / 3=1km / 4=2km（FE-001 §8） */
export type RangeCode = 1 | 2 | 3 | 4;

/** こだわり条件（REQ-001 §6.3） */
export interface Preferences {
  privateRoom: boolean;
  freeDrink: boolean;
  midnight: boolean;
}

export interface SearchRequest {
  lat: number;
  lng: number;
  range: RangeCode;
  budgetMax: BudgetMax;
  /**
   * 予算が未登録の店舗も候補に含めるか。
   *
   * HotPepperの予算絞り込みは店舗が登録した予算帯との一致で行うため、
   * 未登録の店舗は問答無用で除外される。true のときは予算パラメータを
   * 送らず、B/E側で「予算内 または 未登録」に絞る。
   */
  includeUnknownBudget: boolean;
  genreCode: GenreCode;
  preferences: Preferences;
  /** 1以上の整数。HotPepperのページング開始位置 */
  start: number;
}

/**
 * 結果画面が使う項目だけを持つ。
 * 緯度経度・直線距離は返さない（BE-001 §11）。
 */
export interface Shop {
  id: string;
  name: string;
  photoUrl: string | null;
  hotpepperUrl: string;
  budgetText: string | null;
  /** 徒歩時間（分）。店舗の緯度経度が欠けていて算出できない場合は null */
  walkMinutes: number | null;
  /** 営業時間。HotPepperの自由記述をそのまま渡す。未登録なら null */
  openText: string | null;
  /** 定休日。HotPepperの自由記述をそのまま渡す。未登録なら null */
  closedText: string | null;
}

export interface Paging {
  nextStart: number;
  hasMore: boolean;
}

export interface SearchResponse {
  /** HotPepperの返却順（おすすめ順）を保持する。シャッフルはF/E側で行う */
  shops: Shop[];
  paging: Paging;
}

/** エラー時のレスポンス本文 */
export interface ErrorResponse {
  error: string;
}
