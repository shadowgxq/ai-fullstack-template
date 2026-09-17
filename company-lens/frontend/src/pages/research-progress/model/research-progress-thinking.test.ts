import { describe, expect, it } from 'vitest';

import {
  getCompanyResearchThinkingSteps,
  normalizeResearchAgentName,
} from './research-progress-thinking';
import type { CompanyResearchAgentBlock } from '../../../entities/company-research';

describe('research progress thinking data', () => {
  it('normalizes capability and Agent names across API suffixes and separators', () => {
    expect(normalizeResearchAgentName(' Investment-Team_Agent ')).toBe('investment_team');
  });

  it('keeps visible team events in server order and removes accumulated duplicates', () => {
    const steps = getCompanyResearchThinkingSteps([
      {
        id: 'message-1',
        stage: 'THINKING',
        seq: 10,
        metadata: [
          {
            seq: 21,
            eventAgentName: 'business_analyst',
            title: 'Web Search',
            summary: 'Business model evidence collected.',
            visibility: 'user_safe',
          },
          {
            seq: 22,
            eventAgentName: 'financial_analyst',
            title: 'Web Search',
            summary: 'Financial statements reviewed.',
            visibility: 'public',
          },
        ],
      },
      {
        id: 'message-2',
        stage: 'THINKING',
        seq: 11,
        metadata: [
          {
            seq: 22,
            eventAgentName: 'financial_analyst',
            title: 'Web Search',
            summary: 'Financial statements reviewed.',
            visibility: 'public',
          },
          {
            seq: 23,
            eventAgentName: 'team_lead',
            title: 'Team review',
            summary: 'Evidence conflicts reviewed.',
            visibility: 'internal',
          },
        ],
      },
    ]);

    expect(steps).toHaveLength(2);
    expect(steps.map((step) => step.agentName)).toEqual(['business_analyst', 'financial_analyst']);
    expect(steps.at(-1)?.summary).toBe('Financial statements reviewed.');
  });

  it('uses a visible THINKING message body when metadata has no displayable entry', () => {
    const steps = getCompanyResearchThinkingSteps([
      {
        id: 'message-body',
        stage: 'THINKING',
        content: 'The Agent is comparing the latest filings.',
        metadata: [{ visibility: 'internal', summary: 'Hidden detail.' }],
      },
      { id: 'report', stage: 'REPORT', content: 'Report output.' },
    ]);

    expect(steps).toHaveLength(1);
    expect(steps[0]?.summary).toBe('The Agent is comparing the latest filings.');
  });

  it('keeps the latest Agent snapshot visible when message history is not available yet', () => {
    const agent: CompanyResearchAgentBlock = {
      agentRunId: 'agent-run-1',
      agentName: 'investment_research_agent',
      status: 'running',
      progress: 0,
      summary: '开始标准公司研究',
      messages: [],
    };

    const steps = getCompanyResearchThinkingSteps([], agent);

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      agentName: 'investment_research_agent',
      progress: 0,
      summary: '开始标准公司研究',
    });
  });

  it('assigns subagent events to the nested Agent and keeps object source references', () => {
    const steps = getCompanyResearchThinkingSteps([
      {
        id: 'team-message',
        stage: 'THINKING',
        metadata: [
          {
            seq: 31,
            subagent_name: 'financial_analyst',
            summary: 'Quarterly filings reviewed.',
            source_refs: [
              {
                url: 'https://www.sec.gov/filings',
                title: 'SEC EDGAR',
                source_type: 'regulatory',
              },
              { title: 'Company investor relations' },
            ],
            visibility: 'user_safe',
          },
          {
            seq: 32,
            subagentName: 'business_analyst',
            summary: 'Business model evidence collected.',
            sourceRefs: [{ href: 'https://example.com/business' }],
            visibility: 'public',
          },
        ],
      },
    ]);

    expect(steps.map((step) => step.agentName)).toEqual(['financial_analyst', 'business_analyst']);
    expect(steps[0]?.sourceRefs).toEqual([
      'https://www.sec.gov/filings',
      'Company investor relations',
    ]);
    expect(steps[0]?.sourceLinks).toEqual([
      { url: 'https://www.sec.gov/filings', label: 'SEC EDGAR' },
    ]);
    expect(steps[1]?.sourceRefs).toEqual(['https://example.com/business']);
    expect(steps[1]?.sourceLinks).toEqual([
      { url: 'https://example.com/business', label: 'https://example.com/business' },
    ]);
  });
});
