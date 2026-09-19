import { useEffect, useRef, type ReactNode } from 'react';

import styles from './ui.module.css';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** 下から出るシート。Escで閉じ、開いたらフォーカスを移す。 */
export function Sheet({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        className={styles.sheetBackdrop}
        aria-label="閉じる"
        onClick={onClose}
      />
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <h2 className={styles.sheetTitle}>{title}</h2>
        {children}
      </div>
    </>
  );
}
