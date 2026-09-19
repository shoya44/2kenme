import type { BudgetMax, GenreCode, Preferences, RangeCode, Shop } from '../shared/api-types';

export type { BudgetMax, GenreCode, Preferences, RangeCode, Shop };

/** 検索条件（DATA-001 §3）。 */
export interface SearchCondition {
  budgetMax: BudgetMax;
  /** 予算が未登録の店舗も含めるか */
  includeUnknownBudget: boolean;
  genreCode: GenreCode;
  preferences: Preferences;
  range: RangeCode;
}

/** 現在地。sessionStorage にのみ保持する（DATA-001 §6）。 */
export interface GeoPoint {
  lat: number;
  lng: number;
  acquiredAt: number;
}

/** OKした店舗（DATA-001 §10）。写真は保存しない。 */
export interface HistoryEntry {
  shopId: string;
  name: string;
  hotpepperUrl: string;
  budgetText: string | null;
  walkMinutes: number;
  decidedAt: number;
}
