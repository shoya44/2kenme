import { describeCondition, rangeLabel } from '../constants';
import {
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  ExternalLinkIcon,
  PhoneIcon,
  PinIcon,
  YenIcon,
} from './icons';
import styles from './ui.module.css';
import type { SearchCondition, Shop } from '../types';

interface Props {
  shop: Shop;
  /** 実際に検索に使った条件（緩和を適用したあと） */
  condition: SearchCondition;
  relaxNotice: string | null;
  onNg: () => void;
  onOk: () => void;
  disabled: boolean;
}

/** 表示項目は仕様で限定する。評価・レビュー・地図は出さない（FE-001 §11）。 */
export function ShopResult({ shop, condition, relaxNotice, onNg, onOk, disabled }: Props) {
  return (
    <>
      <p className={styles.scope}>
        <PinIcon size={15} />
        現在地から半径{rangeLabel(condition.range)}以内
      </p>

      {relaxNotice && <p className={styles.relaxNotice}>{relaxNotice}</p>}

      {/* 何で検索した結果なのかを常に示す。緩和で条件が変わるため */}
      <p className={styles.conditionSummary}>{describeCondition(condition)}</p>

      <div className={styles.photo}>
        {shop.photoUrl && <img src={shop.photoUrl} alt="" loading="lazy" />}
      </div>

      <h2 className={styles.shopName}>{shop.name}</h2>

      <a
        className={styles.shopUrl}
        href={shop.hotpepperUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ExternalLinkIcon />
        ホットペッパーで見る
      </a>

      {/* 欠けている項目は行ごと出さない。確度の低い値を見せない（FE-001 §11） */}
      <div className={styles.facts}>
        {shop.walkMinutes !== null && (
          <div className={styles.fact}>
            <span className={styles.factIcon}>
              <PinIcon />
            </span>
            <span>徒歩 約{shop.walkMinutes}分</span>
          </div>
        )}

        {shop.budgetText !== null && (
          <div className={styles.fact}>
            <span className={styles.factIcon}>
              <YenIcon />
            </span>
            <span>{shop.budgetText}</span>
          </div>
        )}

        {/* 電話番号は保持せず、HotPepper店舗詳細から確認させる（REQ-001 F-11） */}
        <a
          className={styles.fact}
          href={shop.hotpepperUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className={styles.factIcon}>
            <PhoneIcon size={15} />
          </span>
          <span>連絡先</span>
          <span className={styles.factTail}>
            店舗詳細で確認
            <ChevronRightIcon size={16} />
          </span>
        </a>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.actionButton} ${styles.ngButton}`}
          onClick={onNg}
          disabled={disabled}
        >
          <CloseIcon />
          NG
        </button>

        {/*
          OKは a 要素にする。履歴保存を挟んだ window.open は
          iOS Safari でポップアップブロックされるため（FE-001 §13）。
        */}
        <a
          className={`${styles.actionButton} ${styles.okButton}`}
          href={shop.hotpepperUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOk}
        >
          <CheckIcon />
          OK
        </a>
      </div>
    </>
  );
}
