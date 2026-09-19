/**
 * HotPepper 検索用ディナー予算マスタ。
 *
 * 【生成物】手で編集しない。`npm run gen:budget` で再生成する。
 *
 * ⚠️ 暫定データ（要検証）
 * 生成時にHotPepper APIへ到達できない環境だったため、公開情報から起こした暫定値が入っている。
 * APIキーを用意して `npm run gen:budget` を実行し、この内容を必ず差し替えること。
 * 差し替えるまで、予算上限による絞り込みが実データとずれる可能性がある。
 */

export interface BudgetMasterEntry {
  code: string;
  name: string;
  /** 予算帯の下限（円） */
  min: number;
  /** 予算帯の上限（円）。上限なしの帯は null */
  max: number | null;
}

export const BUDGET_MASTER: readonly BudgetMasterEntry[] = [
  { code: 'B009', name: '～500円', min: 0, max: 500 },
  { code: 'B010', name: '501～1000円', min: 501, max: 1000 },
  { code: 'B011', name: '1001～1500円', min: 1001, max: 1500 },
  { code: 'B001', name: '1501～2000円', min: 1501, max: 2000 },
  { code: 'B002', name: '2001～3000円', min: 2001, max: 3000 },
  { code: 'B003', name: '3001～4000円', min: 3001, max: 4000 },
  { code: 'B008', name: '4001～5000円', min: 4001, max: 5000 },
  { code: 'B004', name: '5001～7000円', min: 5001, max: 7000 },
  { code: 'B005', name: '7001～10000円', min: 7001, max: 10000 },
  { code: 'B006', name: '10001～15000円', min: 10001, max: 15000 },
  { code: 'B012', name: '15001～20000円', min: 15001, max: 20000 },
  { code: 'B013', name: '20001～30000円', min: 20001, max: 30000 },
  { code: 'B014', name: '30001円～', min: 30001, max: null },
] as const;
