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

/** 端末がオフラインだと分かっているときは、原因を添える */
function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function ErrorNotice({ kind, onRetry }: Props) {
  const offline = kind === 'network' && isOffline();

  return (
    <div className={styles.error} role="alert">
      <p className={styles.errorText}>{MESSAGES[kind]}</p>
      {offline && (
        <p className={styles.errorHint}>
          オフラインのようです。電波のある場所でもう一度おためしください。
        </p>
      )}
      <button type="button" className={styles.secondaryCta} onClick={onRetry}>
        再試行
      </button>
    </div>
  );
}
