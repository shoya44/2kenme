import { Sheet } from './Sheet';
import styles from './ui.module.css';

interface Props {
  onClose: () => void;
  onOpenHistory: () => void;
  onResetCondition: () => void;
  onClearHistory: () => void;
  onAbout: () => void;
}

export function MenuSheet({
  onClose,
  onOpenHistory,
  onResetCondition,
  onClearHistory,
  onAbout,
}: Props) {
  const items: { label: string; onClick: () => void }[] = [
    { label: '履歴', onClick: onOpenHistory },
    { label: '条件を初期化', onClick: onResetCondition },
    { label: '履歴を消去', onClick: onClearHistory },
    { label: 'このアプリについて', onClick: onAbout },
  ];

  return (
    <Sheet title="メニュー" onClose={onClose}>
      {items.map((item) => (
        <button key={item.label} type="button" className={styles.menuItem} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </Sheet>
  );
}
