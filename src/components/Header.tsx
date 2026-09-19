import { MenuIcon } from './icons';
import styles from './ui.module.css';

interface Props {
  onOpenMenu: () => void;
  /** アプリ名をタップしたときにトップ画面へ戻る */
  onGoHome: () => void;
}

export function Header({ onOpenMenu, onGoHome }: Props) {
  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.iconButton}
        onClick={onOpenMenu}
        aria-label="メニュー"
      >
        <MenuIcon />
      </button>

      {/* 見出しの意味は保ったまま、押せるようにする */}
      <h1 className={styles.title}>
        <button type="button" className={styles.titleButton} onClick={onGoHome}>
          つぎどこ
        </button>
      </h1>

      <span />
    </header>
  );
}
