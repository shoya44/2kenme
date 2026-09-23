import { describeCondition } from '../constants';
import { SearchOffIcon } from './icons';
import styles from './ui.module.css';
import type { SearchCondition } from '../types';

interface Props {
  /** 実際に検索に使った条件（緩和を適用したあと） */
  condition: SearchCondition;
  /** これ以上緩和できない場合は null */
  relaxCta: string | null;
  onRelax: () => void;
}

/** 検索0件と候補切れを同じ状態として扱う（FE-001 §14）。 */
export function NoCandidate({ condition, relaxCta, onRelax }: Props) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyMark}>
        <SearchOffIcon />
      </span>
      <h2 className={styles.emptyTitle}>候補が見つかりませんでした</h2>
      {/* どの条件で探したのかを示す */}
      <p className={styles.conditionSummary}>{describeCondition(condition)}</p>
      <p className={styles.emptyText}>
        {relaxCta ? (
          <>
            条件を少しゆるめると
            <br />
            見つかるかもしれません
          </>
        ) : (
          <>
            条件を変えて
            <br />
            もう一度おためしください
          </>
        )}
      </p>

      {relaxCta && (
        <button type="button" className={styles.secondaryCta} onClick={onRelax}>
          {relaxCta}
        </button>
      )}
    </div>
  );
}
