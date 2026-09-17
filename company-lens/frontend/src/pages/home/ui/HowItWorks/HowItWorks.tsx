import { useTranslation } from 'react-i18next';

import styles from './HowItWorks.module.css';

const STEP_KEYS = ['industry', 'bottleneck', 'quality', 'funnel', 'checklist'] as const;

export function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section className={styles.root} aria-labelledby="how-heading">
      <header className={styles.head}>
        <h2 id="how-heading" className={styles.heading}>
          {t('home.how.heading')}
        </h2>
        <p className={styles.subheading}>{t('home.how.subheading')}</p>
      </header>

      <ol className={styles.steps}>
        {STEP_KEYS.map((key, index) => (
          <li className={styles.step} key={key}>
            <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
            <h3 className={styles.stepName}>{t(`home.how.steps.${key}.name`)}</h3>
            <p className={styles.stepDesc}>{t(`home.how.steps.${key}.desc`)}</p>
          </li>
        ))}
      </ol>

      <p className={styles.flow}>{t('home.how.flow')}</p>
    </section>
  );
}
