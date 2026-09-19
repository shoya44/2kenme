/**
 * HotPepper 検索用ディナー予算マスタの `name` を予算帯へ解析する。
 *
 *   「～500円」      → { min: 0,     max: 500 }
 *   「2001～3000円」 → { min: 2001,  max: 3000 }
 *   「30001円～」    → { min: 30001, max: null }
 *
 * 全角チルダ（～）と半角チルダ（~）、桁区切りのカンマを受け付ける。
 * 解析できない表記は例外にする。無言で予算帯が欠落する方が危険なため（BE-001 §6）。
 */
export function parseBudgetName(name: string): { min: number; max: number | null } {
  const normalized = name.replace(/[~～]/g, '~').replace(/,/g, '').trim();

  const upperOnly = /^~(\d+)円$/.exec(normalized);
  if (upperOnly?.[1]) {
    return { min: 0, max: Number(upperOnly[1]) };
  }

  const lowerOnly = /^(\d+)円~$/.exec(normalized);
  if (lowerOnly?.[1]) {
    return { min: Number(lowerOnly[1]), max: null };
  }

  const both = /^(\d+)~(\d+)円$/.exec(normalized);
  if (both?.[1] && both[2]) {
    return { min: Number(both[1]), max: Number(both[2]) };
  }

  throw new Error(`予算帯を解析できません: ${JSON.stringify(name)}`);
}
