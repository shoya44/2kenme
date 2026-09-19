import type { ReactNode } from 'react';

import styles from './ui.module.css';

interface Props {
  label: string;
  /** 選択中のインデックス */
  index: number;
  options: readonly { label: string }[];
  onChange: (index: number) => void;
  /** 目盛りラベルの出し方。7段階では両端のみにする（FE-001 §5） */
  ticks?: 'all' | 'ends';
  /** 目盛りの下に置く補助的なコントロール */
  children?: ReactNode;
}

/**
 * 離散スライダー。
 *
 * input[type=range] をベースにする。カスタム実装はキーボード操作と
 * スクリーンリーダー対応のコストが見合わないため（FE-001 §9）。
 */
export function DiscreteSlider({
  label,
  index,
  options,
  onChange,
  ticks = 'all',
  children,
}: Props) {
  const current = options[index];
  const first = options[0];
  const last = options[options.length - 1];

  const tickItems =
    ticks === 'all' ? options : first && last && first !== last ? [first, last] : [];

  return (
    <div className={styles.section}>
      <div className={styles.rowHead}>
        <span className={styles.label} id={`${label}-label`}>
          {label}
        </span>
        <span className={styles.value}>{current?.label}</span>
      </div>

      <input
        type="range"
        className={styles.slider}
        min={0}
        max={options.length - 1}
        step={1}
        value={index}
        aria-labelledby={`${label}-label`}
        aria-valuetext={current?.label}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />

      <div className={styles.ticks} aria-hidden="true">
        {tickItems.map((option) => (
          <span key={option.label}>{option.label}</span>
        ))}
      </div>

      {children}
    </div>
  );
}
