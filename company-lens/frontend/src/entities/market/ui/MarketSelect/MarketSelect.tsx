import clsx from 'clsx';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { MARKET_CODES, MARKET_LABEL_KEY } from '../../model/market.constants';
import type { MarketCode } from '../../model/market.types';
import styles from './MarketSelect.module.css';

export type MarketSelectProps = {
  value: MarketCode;
  onChange: (market: MarketCode) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

export function MarketSelect({
  value,
  onChange,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: MarketSelectProps) {
  const { t } = useTranslation();
  const groupName = useId();

  return (
    <fieldset className={clsx(styles.root, className)} aria-label={ariaLabel}>
      <legend className={styles.visuallyHidden}>{ariaLabel}</legend>
      {MARKET_CODES.map((code) => (
        <label key={code} className={styles.option} data-active={code === value}>
          <input
            className={styles.input}
            type="radio"
            name={groupName}
            value={code}
            checked={code === value}
            disabled={disabled}
            onChange={() => onChange(code)}
          />
          <span>{t(MARKET_LABEL_KEY[code])}</span>
        </label>
      ))}
    </fieldset>
  );
}
