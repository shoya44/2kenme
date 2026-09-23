import { useState } from 'react';

import styles from '../components/ui.module.css';

interface Props {
  /** 合言葉が拒否された直後か。理由を添えるため */
  rejected: boolean;
  onSubmit: (passcode: string) => void;
}

/**
 * 合言葉の入力（FE-001 §29）。
 *
 * 身内向けの利用に絞るための仕切りで、個人認証ではない。入力は端末に保存し、
 * 次回以降は聞かない。サーバーに拒否されたときだけ再度ここへ戻る。
 */
export function PasscodeScreen({ rejected, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const trimmed = value.trim();

  return (
    <form
      className={styles.body}
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed.length > 0) {
          onSubmit(trimmed);
        }
      }}
    >
      <div className={styles.section}>
        <label className={styles.label} htmlFor="passcode">
          合言葉
        </label>
        <input
          id="passcode"
          className={styles.textInput}
          type="password"
          value={value}
          autoComplete="current-password"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => setValue(e.currentTarget.value)}
        />
        <p className={styles.budgetNote}>
          このアプリは身内で使うため、合言葉が必要です。一度入れればこの端末では次回から聞きません。
        </p>
      </div>

      {rejected && (
        <div className={styles.error} role="alert">
          <p className={styles.errorText}>合言葉が違います</p>
        </div>
      )}

      <div className={`${styles.ctaWrap} ${styles.pushDown}`}>
        <button type="submit" className={styles.cta} disabled={trimmed.length === 0}>
          はじめる
        </button>
      </div>
    </form>
  );
}
