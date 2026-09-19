import { HotpepperCredit } from './HotpepperCredit';
import { ChevronRightIcon } from './icons';
import { Sheet } from './Sheet';
import styles from './ui.module.css';
import type { HistoryEntry } from '../types';

interface Props {
  entries: readonly HistoryEntry[];
  onClose: () => void;
  onClear: () => void;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`;
}

/** 店舗写真は保存しないため、テキストのみを並べる（DATA-001 §10）。 */
export function HistorySheet({ entries, onClose, onClear }: Props) {
  return (
    <Sheet title="履歴" onClose={onClose}>
      {entries.length === 0 ? (
        <p className={styles.emptyNote}>OKした店舗がここに残ります。</p>
      ) : (
        <>
          {entries.map((entry) => (
            <a
              key={entry.shopId}
              className={styles.historyItem}
              href={entry.hotpepperUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={styles.historyMain}>
                <span className={styles.historyName}>{entry.name}</span>
                <span className={styles.historyMeta}>
                  徒歩 約{entry.walkMinutes}分{entry.budgetText ? ` ・ ${entry.budgetText}` : ''}
                </span>
              </span>
              <span className={styles.historyDate}>{formatDate(entry.decidedAt)}</span>
              <ChevronRightIcon />
            </a>
          ))}

          <button
            type="button"
            className={`${styles.menuItem} ${styles.dangerItem}`}
            onClick={onClear}
          >
            履歴を消去
          </button>
        </>
      )}

      <HotpepperCredit />
    </Sheet>
  );
}
