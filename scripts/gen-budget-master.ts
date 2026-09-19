/**
 * HotPepper 検索用ディナー予算マスタから worker/budget-master.generated.ts を生成する。
 *
 *   HOTPEPPER_API_KEY=xxxx npm run gen:budget
 *
 * マスタは頻繁に変わらないため生成物をコミットする。CIで再生成しての差分検知は行わない。
 * 解析できない項目が1件でもあれば異常終了する。無言で予算帯が欠落する方が危険なため（BE-001 §6）。
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseBudgetName } from './parse-budget-name';

const ENDPOINT = 'https://webservice.recruit.co.jp/hotpepper/budget/v1/';
const OUT = resolve(import.meta.dirname, '../worker/budget-master.generated.ts');

interface MasterEntry {
  code: string;
  name: string;
  min: number;
  max: number | null;
}

async function main(): Promise<void> {
  const key = process.env.HOTPEPPER_API_KEY;
  if (!key) {
    throw new Error('HOTPEPPER_API_KEY が未設定です');
  }

  const url = `${ENDPOINT}?key=${encodeURIComponent(key)}&format=json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`マスタ取得に失敗しました: HTTP ${res.status}`);
  }

  const body = (await res.json()) as {
    results?: { budget?: { code?: string; name?: string }[]; error?: { message?: string }[] };
  };

  const upstreamError = body.results?.error?.[0];
  if (upstreamError) {
    throw new Error(`マスタ取得に失敗しました: ${upstreamError.message ?? 'unknown'}`);
  }

  const raw = body.results?.budget ?? [];
  if (raw.length === 0) {
    throw new Error('マスタが空です');
  }

  const entries: MasterEntry[] = raw.map((item) => {
    if (!item.code || !item.name) {
      throw new Error(`code / name が欠けています: ${JSON.stringify(item)}`);
    }
    return { code: item.code, name: item.name, ...parseBudgetName(item.name) };
  });

  entries.sort((a, b) => a.min - b.min);

  const rows = entries
    .map(
      (e) =>
        `  { code: '${e.code}', name: '${e.name}', min: ${e.min}, max: ${e.max === null ? 'null' : e.max} },`,
    )
    .join('\n');

  writeFileSync(
    OUT,
    `/**
 * HotPepper 検索用ディナー予算マスタ。
 *
 * 【生成物】手で編集しない。\`npm run gen:budget\` で再生成する。
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
${rows}
] as const;
`,
    'utf8',
  );

  console.log(`${entries.length}件の予算帯を ${OUT} へ書き出しました`);
}

await main();
