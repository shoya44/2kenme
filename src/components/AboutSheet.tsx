import { Sheet } from './Sheet';
import styles from './ui.module.css';

/** メニューの「このアプリについて」。 */
export function AboutSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="このアプリについて" onClose={onClose}>
      <div className={styles.about}>
        <p className={styles.aboutLead}>2軒目を、1軒だけ。</p>
        <p>
          条件に合う近くのお店を1軒だけ提案します。合わなければNG、合えばOK。
          一覧やランキングは出しません。
        </p>
        <p>
          店舗情報は{' '}
          <a
            href="https://webservice.recruit.co.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.aboutLink}
          >
            ホットペッパーグルメ Webサービス
          </a>{' '}
          を利用しています。
        </p>
        <p className={styles.aboutNote}>
          現在地は検索のたびに取得し、端末の外へ保存しません。
          OKしたお店とさがす条件は、この端末の中だけに残ります。
        </p>
      </div>
    </Sheet>
  );
}
