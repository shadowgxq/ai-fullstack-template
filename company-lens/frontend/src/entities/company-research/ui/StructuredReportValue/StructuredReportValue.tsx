import { ExternalLink } from 'lucide-react';

import { humanizeReportKey } from '../../model/company-research.report';
import type { JsonValue } from '../../model/company-research.types';
import styles from './StructuredReportValue.module.css';

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function StructuredReportValue({ value }: { value: JsonValue }) {
  if (value === null) return null;
  if (typeof value === 'string') {
    return isHttpUrl(value) ? (
      <a className={styles.link} href={value} target="_blank" rel="noreferrer">
        {value}
        <ExternalLink size={13} aria-hidden />
      </a>
    ) : (
      <p className={styles.text}>{value}</p>
    );
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className={styles.scalar}>{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className={styles.list}>
        {value.map((item, index) => (
          <li key={index}>
            <StructuredReportValue value={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <dl className={styles.fields}>
      {Object.entries(value).map(([key, fieldValue]) => (
        <div className={styles.field} key={key}>
          <dt>{humanizeReportKey(key)}</dt>
          <dd>
            <StructuredReportValue value={fieldValue} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
