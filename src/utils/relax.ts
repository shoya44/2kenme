import type { SearchCondition } from '../types';

/** 条件緩和の段階（FE-001 §15）。 */
export type RelaxLevel = 0 | 1 | 2 | 3 | 4;

export const MAX_RELAX_LEVEL = 4;

/** 緩和CTAの文言と、緩和後に結果画面へ出す通知。 */
export const RELAX_LABELS: Record<Exclude<RelaxLevel, 0>, { cta: string; notice: string }> = {
  1: { cta: 'こだわり条件を外してさがす', notice: 'こだわり条件を外して再検索しました' },
  2: { cta: 'ジャンルをおまかせにしてさがす', notice: 'ジャンル指定を外して再検索しました' },
  3: { cta: 'もう少し広い範囲でさがす', notice: '範囲を広げて再検索しました' },
  4: { cta: '予算の上限を外してさがす', notice: '予算の上限を外して再検索しました' },
};

/**
 * 緩和段階を条件へ適用する。
 *
 * 緩和は累積する（level=3 なら 1・2 の緩和も適用済み）。
 * `condition` 本体は書き換えず導出する。「条件を変更」でトップへ戻ったときに
 * 元の条件が見えるようにするため（FE-001 §15）。
 */
export function applyRelax(condition: SearchCondition, level: RelaxLevel): SearchCondition {
  const relaxed: SearchCondition = {
    ...condition,
    preferences: { ...condition.preferences },
  };

  if (level >= 1) {
    relaxed.preferences = { privateRoom: false, freeDrink: false, midnight: false };
  }
  if (level >= 2) {
    relaxed.genreCode = null;
  }
  if (level >= 3 && relaxed.range < 4) {
    relaxed.range = (relaxed.range + 1) as SearchCondition['range'];
  }
  if (level >= 4) {
    relaxed.budgetMax = null;
  }

  return relaxed;
}

/** その段階が条件を実際に変えるか。 */
function changesCondition(condition: SearchCondition, level: Exclude<RelaxLevel, 0>): boolean {
  switch (level) {
    case 1:
      return Object.values(condition.preferences).some(Boolean);
    case 2:
      return condition.genreCode !== null;
    case 3:
      return condition.range < 4;
    case 4:
      return condition.budgetMax !== null;
  }
}

/**
 * 次に進む緩和段階を返す。これ以上緩和できなければ null。
 *
 * 条件が実際に変わらない段階は飛ばす（FE-001 §15）。
 * 例えばこだわりを何も付けていなければ段階1を飛ばす。飛ばさないと
 * 「こだわり条件を外してさがす」を押しても同じ条件で検索し直すだけになり、
 * 何が起きたのか分からない。
 */
export function nextRelaxLevel(
  condition: SearchCondition,
  level: RelaxLevel,
): Exclude<RelaxLevel, 0> | null {
  for (let next = level + 1; next <= MAX_RELAX_LEVEL; next++) {
    const candidate = next as Exclude<RelaxLevel, 0>;
    if (changesCondition(condition, candidate)) {
      return candidate;
    }
  }
  return null;
}
