import { GENRE_OPTIONS } from '../constants';
import styles from './ui.module.css';
import type { GenreCode } from '../types';

interface Props {
  value: GenreCode;
  onChange: (code: GenreCode) => void;
}

/** 単一選択。選択状態は差し色に加えて aria-pressed で伝える（FE-001 §6, §27）。 */
export function GenreChips({ value, onChange }: Props) {
  return (
    <div className={styles.section}>
      <div className={styles.rowHead}>
        <span className={styles.label} id="genre-label">
          ジャンル
        </span>
      </div>

      <div className={styles.chips} role="group" aria-labelledby="genre-label">
        {GENRE_OPTIONS.map((option) => (
          <button
            key={option.code ?? 'any'}
            type="button"
            className={styles.chip}
            aria-pressed={option.code === value}
            onClick={() => onChange(option.code)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
