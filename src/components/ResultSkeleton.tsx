import styles from './ui.module.css';

/** 先読み中に候補が尽きたときの繋ぎ（FE-001 §20）。 */
export function ResultSkeleton() {
  return (
    <div aria-live="polite" aria-busy="true">
      <span className={styles.visuallyHidden}>次の候補を探しています</span>
      <div className={`${styles.photo} ${styles.skeleton}`} />
      <div className={`${styles.skeletonName} ${styles.skeleton}`} />
    </div>
  );
}
