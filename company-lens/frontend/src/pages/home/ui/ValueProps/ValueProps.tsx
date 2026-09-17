import { useTranslation } from 'react-i18next';

import styles from './ValueProps.module.css';

const ITEM_KEYS = ['focus', 'consensus', 'trace'] as const;

export function ValueProps() {
  const { t } = useTranslation();

  return (
    <section className={styles.root} aria-labelledby="value-heading">
      <h2 id="value-heading" className={styles.heading}>
        {t('home.value.heading')}
      </h2>

      <div className={styles.grid}>
        {ITEM_KEYS.map((key, index) => (
          <article className={styles.card} key={key}>
            <span className={styles.mark}>{String(index + 1).padStart(2, '0')}</span>
            <h3 className={styles.cardTitle}>{t(`home.value.items.${key}.title`)}</h3>
            <p className={styles.cardDesc}>{t(`home.value.items.${key}.desc`)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
