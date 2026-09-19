import { MenuIcon } from './icons';
import styles from './ui.module.css';

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
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
      <h1 className={styles.title}>つぎどこ</h1>
      <span />
    </header>
  );
}
