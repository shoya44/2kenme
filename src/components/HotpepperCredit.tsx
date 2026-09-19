import styles from './ui.module.css';

/** HotPepperのデータを表示する全画面に置く（FE-001 §26）。 */
export function HotpepperCredit() {
  return (
    <small className={styles.credit}>
      Powered by{' '}
      <a href="https://webservice.recruit.co.jp/" target="_blank" rel="noopener noreferrer">
        ホットペッパーグルメ Webサービス
      </a>
    </small>
  );
}
