import styles from './ui.module.css';
import type { ErrorKind } from '../state/reducer';

const MESSAGES: Record<ErrorKind, string> = {
  location: '現在地を取得できませんでした',
  network: '店舗を取得できませんでした',
};

interface Props {
  kind: ErrorKind;
  onRetry: () => void;
}

export function ErrorNotice({ kind, onRetry }: Props) {
  return (
    <div className={styles.error} role="alert">
      <p className={styles.errorText}>{MESSAGES[kind]}</p>
      <button type="button" className={styles.relaxCta} onClick={onRetry}>
        再試行
      </button>
    </div>
  );
}
