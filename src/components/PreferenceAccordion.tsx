import { PREFERENCE_LABELS } from '../constants';
import { ChevronRightIcon } from './icons';
import styles from './ui.module.css';
import type { Preferences } from '../types';

interface Props {
  value: Preferences;
  onChange: (next: Preferences) => void;
}

const KEYS = ['privateRoom', 'freeDrink', 'midnight'] as const;

/** 初期状態は閉じる（FE-001 §7）。 */
export function PreferenceAccordion({ value, onChange }: Props) {
  const selected = KEYS.filter((key) => value[key]).length;

  return (
    <div className={styles.section}>
      <details className={styles.accordion}>
        <summary className={styles.accordionSummary}>
          <span className={styles.label}>こだわり</span>
          <span className={styles.summaryRight}>
            {selected > 0 ? `${selected}件選択` : '指定なし'}
            <ChevronRightIcon />
          </span>
        </summary>

        <div className={styles.checkList}>
          {KEYS.map((key) => (
            <label key={key} className={styles.checkRow}>
              <input
                type="checkbox"
                checked={value[key]}
                onChange={(e) => onChange({ ...value, [key]: e.currentTarget.checked })}
              />
              {PREFERENCE_LABELS[key]}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
