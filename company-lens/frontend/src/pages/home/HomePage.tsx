import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { AppShell } from '../../widgets/app-shell';
import { HowItWorks } from './ui/HowItWorks';
import { ValueProps } from './ui/ValueProps';
import styles from './HomePage.module.css';

export function HomePage() {
  const { t } = useTranslation();

  return (
    <AppShell className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden="true" />
            {t('home.badge')}
          </span>

          <h1 className={styles.title}>
            <span className={styles.titleLead}>{t('home.titleLead')}</span>
            <span className={styles.titleAccent}>{t('home.titleAccent')}</span>
          </h1>

          <p className={styles.subtitle}>{t('home.subtitle')}</p>

          <Link className={styles.heroCta} to="/research/new" data-umami-event="开始研究-首页主CTA">
            {t('home.startFree')}
          </Link>

          <p className={styles.disclaimer}>{t('home.disclaimer')}</p>
        </section>

        <HowItWorks />
        <ValueProps />

        <section className={styles.cta} aria-labelledby="cta-heading">
          <h2 id="cta-heading" className={styles.ctaHeading}>
            {t('home.cta.heading')}
          </h2>
          <p className={styles.ctaSubtitle}>{t('home.cta.subtitle')}</p>
          <Link
            className={styles.ctaButton}
            to="/research/new"
            data-umami-event="开始研究-首页底部CTA"
          >
            {t('home.startFree')}
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
