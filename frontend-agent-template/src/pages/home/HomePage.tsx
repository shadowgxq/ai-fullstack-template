import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DemoControls } from './components/DemoControls';
import styles from './HomePage.module.css';

const sectionKeys = ['appShell', 'layeredSource', 'projectDocs'] as const;
const stack = ['Vite 6', 'React 18', 'TypeScript 5'];

export function HomePage() {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />

      <main className={styles.main}>
        <DemoControls />

        <header className={styles.hero}>
          <span className={styles.badge}>
            <span className={styles.dot} aria-hidden="true" />
            {t('home.status')}
          </span>

          <h1 className={styles.title}>{t('home.title')}</h1>
          <p className={styles.description}>{t('home.description')}</p>

          <div className={styles.actions}>
            <a className={styles.cta} href="#structure">
              {t('home.cta')}
              <ArrowRight className={styles.arrow} size={18} aria-hidden="true" />
            </a>
          </div>

          <ul className={styles.stack}>
            {stack.map((item) => (
              <li className={styles.chip} key={item}>
                {item}
              </li>
            ))}
          </ul>
        </header>

        <section id="structure" className={styles.panel} aria-label={t('app.title')}>
          {sectionKeys.map((key, index) => (
            <article className={styles.item} key={key}>
              <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
              <h2 className={styles.itemTitle}>{t(`home.sections.${key}.title`)}</h2>
              <p className={styles.itemText}>{t(`home.sections.${key}.text`)}</p>
            </article>
          ))}
        </section>

        <footer className={styles.footer}>{t('home.footer')}</footer>
      </main>
    </div>
  );
}
