import { useTranslation } from 'react-i18next';

import { ResearchLaunchForm } from '../../features/research-launch';
import { AppShell } from '../../widgets/app-shell';
import styles from './ResearchPage.module.css';

export function ResearchPage() {
  const { t } = useTranslation();

  return (
    <AppShell className={styles.page}>
      <main className={styles.main}>
        <header className={styles.head}>
          <h1 className={styles.title}>{t('research.page.title')}</h1>
          <p className={styles.subtitle}>{t('research.page.subtitle')}</p>
        </header>

        <div className={styles.startLayout}>
          <ResearchLaunchForm />
        </div>
        <p className={styles.disclaimer}>{t('home.disclaimer')}</p>
      </main>
    </AppShell>
  );
}
