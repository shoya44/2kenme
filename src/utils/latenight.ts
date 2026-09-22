import type { SearchCondition } from '../types';

/** 深夜帯の開始（この時刻以降）。 */
const START_HOUR = 22;
const START_MINUTE = 30;

/** 深夜帯の終了（この時刻より前）。 */
const END_HOUR = 5;

/**
 * 深夜帯か（端末のローカル時刻で判定）。
 *
 * 2軒目を探すのはたいていこの時間帯で、営業時間外の店を提案しても意味がない。
 */
export function isLateNight(now: Date = new Date()): boolean {
  const hour = now.getHours();
  const minute = now.getMinutes();

  if (hour < END_HOUR) {
    return true;
  }
  return hour > START_HOUR || (hour === START_HOUR && minute >= START_MINUTE);
}

/**
 * 深夜帯なら「23時以降営業」を既定でONにする（FE-001 §7）。
 *
 * 自動で検索条件を変えるが、結果画面・候補なし画面の条件表示に必ず出るうえ、
 * トップ画面でユーザーが外せる。前回条件の復元（REQ-001 F-08）より
 * 「いま開いている店を出す」を優先する。
 */
export function withLateNightDefault(
  condition: SearchCondition,
  now: Date = new Date(),
): SearchCondition {
  if (!isLateNight(now) || condition.preferences.midnight) {
    return condition;
  }
  return {
    ...condition,
    preferences: { ...condition.preferences, midnight: true },
  };
}
