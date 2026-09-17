import { ChevronRight, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { CompanyResearchCapability } from '../../../../entities/company-research';
import { humanizeReportKey } from '../../../../entities/company-research';
import styles from './AgentReportReferences.module.css';

export type AgentReportReferencesProps = Readonly<{
  capabilities: readonly CompanyResearchCapability[];
  taskId: string;
  returnTo: string;
}>;

function getCapabilityLabelKey(name: string): 'fundamentals' | 'team' | 'management' | 'synthesis' {
  const normalizedName = name.trim().toLowerCase().replace(/[-\s]+/g, '_');
  if (normalizedName.includes('management')) return 'management';
  if (normalizedName.includes('team')) return 'team';
  if (normalizedName.includes('synthesis')) return 'synthesis';
  return 'fundamentals';
}

function getCapabilityLabel(
  capability: CompanyResearchCapability,
  translate: (key: string) => string,
): string {
  const normalizedName = capability.name.trim();
  if (normalizedName.length === 0) {
    return capability.displayName?.trim() || humanizeReportKey(capability.name);
  }
  return translate(`companyResearch.capabilities.${getCapabilityLabelKey(normalizedName)}`);
}

export function AgentReportReferences({ capabilities, taskId, returnTo }: AgentReportReferencesProps) {
  const { t } = useTranslation();

  if (capabilities.length === 0) {
    return null;
  }

  return (
    <section className={styles.references} aria-labelledby="agent-report-references-title">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>{t('companyResearch.result.agentsEyebrow')}</span>
          <h2 id="agent-report-references-title" className={styles.title}>
            {t('companyResearch.result.agentsTitle')}
          </h2>
        </div>
        <Link
          className={styles.progressLink}
          to={`/research/${encodeURIComponent(taskId)}/progress`}
          state={{ returnTo }}
        >
          {t('companyResearch.result.viewProgress')}
          <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <ul className={styles.list}>
        {capabilities.map((capability) => {
          const label = getCapabilityLabel(capability, t);
          const statusLabel = t(`companyResearch.capabilityStatus.${capability.status}`);
          const reportPath = `/research/${encodeURIComponent(taskId)}/agents/${encodeURIComponent(capability.name)}/report`;

          return (
            <li className={styles.item} data-status={capability.status} key={capability.name}>
              <span className={styles.icon} aria-hidden="true">
                <FileText size={17} />
              </span>
              <span className={styles.copy}>
                <strong>{label}</strong>
                <span>{statusLabel}</span>
              </span>
              {capability.status === 'succeeded' ? (
                <Link
                  className={styles.reportLink}
                  to={reportPath}
                  state={{ returnTo }}
                  aria-label={t('companyResearch.result.agentReportAriaLabel', { name: label })}
                >
                  {t('research.result.agentReport')}
                  <ChevronRight size={15} aria-hidden="true" />
                </Link>
              ) : (
                <span className={styles.unavailable}>{statusLabel}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
