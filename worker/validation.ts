import { HttpError } from './http';
import {
  BUDGET_MAX_OPTIONS,
  GENRE_CODES,
  type BudgetMax,
  type GenreCode,
  type Preferences,
  type RangeCode,
  type SearchRequest,
} from '../shared/api-types';

function bad(message: string): never {
  throw new HttpError(400, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertFiniteInRange(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    bad(`invalid ${field}`);
  }
  return value;
}

function assertPreferences(value: unknown): Preferences {
  if (!isRecord(value)) {
    bad('invalid preferences');
  }
  const keys = ['privateRoom', 'freeDrink', 'midnight'] as const;
  for (const key of keys) {
    if (typeof value[key] !== 'boolean') {
      bad(`invalid preferences.${key}`);
    }
  }
  return {
    privateRoom: value.privateRoom as boolean,
    freeDrink: value.freeDrink as boolean,
    midnight: value.midnight as boolean,
  };
}

function assertBudgetMax(value: unknown): BudgetMax {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'number' || !(BUDGET_MAX_OPTIONS as readonly number[]).includes(value)) {
    bad('invalid budgetMax');
  }
  return value as BudgetMax;
}

function assertGenreCode(value: unknown): GenreCode {
  if (value === null) {
    return null;
  }
  // allowlist照合。HotPepperへ任意文字列を通さない（BE-001 §4）
  if (typeof value !== 'string' || !(GENRE_CODES as readonly string[]).includes(value)) {
    bad('invalid genreCode');
  }
  return value as GenreCode;
}

function assertRange(value: unknown): RangeCode {
  if (value !== 1 && value !== 2 && value !== 3 && value !== 4) {
    bad('invalid range');
  }
  return value;
}

function assertStart(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    bad('invalid start');
  }
  return value;
}

/**
 * リクエスト本文を検証して `SearchRequest` にする（BE-001 §4）。
 * 不正な入力はすべて 400 にする。
 */
export function validateSearchRequest(body: unknown): SearchRequest {
  if (!isRecord(body)) {
    bad('invalid body');
  }

  return {
    lat: assertFiniteInRange(body.lat, -90, 90, 'lat'),
    lng: assertFiniteInRange(body.lng, -180, 180, 'lng'),
    range: assertRange(body.range),
    budgetMax: assertBudgetMax(body.budgetMax),
    genreCode: assertGenreCode(body.genreCode),
    preferences: assertPreferences(body.preferences),
    start: assertStart(body.start),
  };
}
