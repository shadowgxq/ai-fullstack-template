import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ResearchAgentProgress, ResearchThinkingStep } from '../../../../entities/research';
import { i18n } from '../../../../shared/i18n';
import { AgentProgressRow } from './AgentProgressRow';

const agent: ResearchAgentProgress = {
  agentId: 'agent-1',
  agentType: 'industry_research',
  displayName: 'Industry Research',
  status: 'completed',
  reportReady: true,
  canRetry: false,
};

const thinkingStep: ResearchThinkingStep = {
  stepId: 'step-1',
  agentId: agent.agentId,
  agentType: agent.agentType,
  title: 'Evidence review',
  summary: 'Validated the primary sources.',
};

function AgentRowHarness() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <ul>
          <AgentProgressRow
            projectId="project-1"
            agent={agent}
            thinkingSteps={[thinkingStep]}
            isExpanded={isExpanded}
            resultReady={false}
            retryPending={false}
            onToggle={() => setIsExpanded((current) => !current)}
            onRetry={vi.fn()}
            onNavigate={vi.fn()}
          />
        </ul>
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe('AgentProgressRow', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps a completed report link visible while the thinking process is collapsed', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    render(<AgentRowHarness />);

    const row = screen.getByRole('listitem');
    const reportLink = within(row).getByRole('link', {
      name: 'Industry Research, Completed, Read report',
    });
    const toggle = within(row).getByRole('button', {
      name: 'Industry Research, Completed, Expand research process',
    });

    expect(reportLink).toHaveAttribute('href', '/research/project-1/agents/agent-1/report');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(row).getAllByRole('link', { name: /Read report/ })).toHaveLength(1);

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(row).getAllByRole('link', { name: /Read report/ })).toHaveLength(1);
    expect(within(row).getByText('Evidence review')).toBeInTheDocument();
  });

  it('renders a subdued terminal note instead of a waiting message for a cancelled Agent', async () => {
    await i18n.changeLanguage('en');
    const cancelledAgent: ResearchAgentProgress = {
      ...agent,
      status: 'cancelled',
      reportReady: false,
    };

    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <ul>
            <AgentProgressRow
              projectId="project-1"
              agent={cancelledAgent}
              thinkingSteps={[]}
              isExpanded={false}
              resultReady={false}
              retryPending={false}
              onToggle={vi.fn()}
              onRetry={vi.fn()}
              onNavigate={vi.fn()}
            />
          </ul>
        </MemoryRouter>
      </I18nextProvider>,
    );

    const row = screen.getByRole('listitem');
    expect(row).toHaveAttribute('data-status', 'cancelled');
    expect(
      within(row).getByText('No research record was generated for this run'),
    ).toBeInTheDocument();
    expect(within(row).queryByText('Waiting for the research process')).not.toBeInTheDocument();
  });

  it('opens the thinking process in a dialog on mobile and restores the collapsed row on close', async () => {
    await i18n.changeLanguage('en');
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(max-width: 720px)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    const user = userEvent.setup();
    render(<AgentRowHarness />);

    const toggle = screen.getByRole('button', {
      name: 'Industry Research, Completed, Expand research process',
    });
    await user.click(toggle);

    expect(
      screen.getByRole('dialog', { name: 'Industry Research research process' }),
    ).toBeVisible();
    expect(screen.getByRole('region', { name: /Full research process/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close research process' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });
});
