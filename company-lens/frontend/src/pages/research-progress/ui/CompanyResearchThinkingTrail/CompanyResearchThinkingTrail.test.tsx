import { cleanup, render, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { i18n } from '../../../../shared/i18n';
import type { CompanyResearchAgentBlock } from '../../../../entities/company-research';
import type { CompanyResearchThinkingStep } from '../../model/research-progress-thinking';
import { CompanyResearchThinkingTrail } from './CompanyResearchThinkingTrail';

const agent: CompanyResearchAgentBlock = {
  agentName: 'industry_research_agent',
  status: 'running',
  messages: [],
};

const steps: readonly CompanyResearchThinkingStep[] = [
  {
    stepId: 'step-1',
    agentName: 'industry_research_agent',
    eventType: 'capability_started',
    summary: 'Research started.',
    createTime: '2026-01-01T09:30:00Z',
  },
  {
    stepId: 'step-2',
    agentName: 'industry_research_agent',
    eventType: 'web_search_completed',
    summary: 'Annual report reviewed.',
    sourceRefs: ['https://example.com/annual-report'],
    sourceLinks: [{ url: 'https://example.com/annual-report', label: 'Annual report' }],
    createTime: '2026-01-01T09:31:00Z',
  },
];

describe('CompanyResearchThinkingTrail', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(cleanup);

  it('renders a compact ordered timeline with semantic times and source links', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <CompanyResearchThinkingTrail
          id="industry-thinking"
          agentName="Industry research"
          agent={agent}
          steps={steps}
          isExpanded
        />
      </I18nextProvider>,
    );

    const timeline = within(container).getByRole('region', {
      name: 'Full research process for Industry research',
    });
    const items = timeline.querySelectorAll('[data-thinking-step]');

    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Research capability started');
    expect(items[1]).toHaveTextContent('Web search completed');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(timeline.querySelector('time[datetime="2026-01-01T09:30:00Z"]')).toBeInTheDocument();
    expect(within(timeline).getByRole('link', { name: 'Annual report' })).toHaveAttribute(
      'href',
      'https://example.com/annual-report',
    );
  });
});
