import { describe, expect, it } from 'vitest';

import type {
  CompanyResearchReport,
  CompanyResearchTask,
} from '../../../entities/company-research';
import { mapCompanyResearchReportToSharePayload } from './research-result-share.mapper';

const task: CompanyResearchTask = {
  taskId: '1874001493837324289',
  query: 'NVIDIA',
  status: 'completed',
  reportReady: true,
  companyName: 'NVIDIA',
  stockCode: 'NVDA',
  market: 'US',
  industry: 'Semiconductors',
  capabilities: [],
  completedAt: '2026-07-28T10:00:00Z',
};

const report: CompanyResearchReport = {
  overall_conclusion: {
    decision: 'HOLD',
    decision_label: 'Watch',
    reason: 'Wait for a wider margin of safety.',
    maximum_risk: 'Valuation leaves less room for error.',
  },
  direct_answer: 'Durable moat and strong cash generation.',
  agent_results: [
    {
      agent_name: 'investment_research_agent',
      report_markdown:
        '# Research report\n\n## Business model\n\nPlatform economics support margins.',
    },
  ],
};

const shareLabels = {
  productName: 'AI Berkshire',
  slogan: 'Research with evidence.',
  researchType: 'Company research',
  conclusion: 'Conclusion',
  judgments: 'Key judgments',
  decision: 'Decision',
  confidence: 'Confidence',
  companyQuality: 'Company quality',
  valuationStatus: 'Valuation',
  longTermOutlook: 'Long-term outlook',
  opportunity: 'Opportunity',
  risk: 'Risk',
  insufficientData: 'Insufficient data',
  decisionLabels: { HOLD: 'Hold', BUY: 'Buy' },
} as const;

describe('company research result share mapper', () => {
  it('maps Task and Report into the existing local share payload', () => {
    const payload = mapCompanyResearchReportToSharePayload(task, report, shareLabels);

    expect(payload).toMatchObject({
      subjectKind: 'research-result',
      targetId: '1874001493837324289',
      projectId: '1874001493837324289',
      landingCapability: 'project',
      riskStatement: 'Valuation leaves less room for error.',
      poster: {
        variant: 'research-brief',
        eyebrow: 'AI Berkshire',
        badge: 'Conclusion',
        metadata: ['NVIDIA', 'NVDA', 'Company research'],
        researchBrief: {
          decisionLabel: 'Decision',
          decision: 'Watch',
          confidenceLabel: 'Confidence',
          confidence: 'Insufficient data',
          summary: 'Wait for a wider margin of safety.',
          metricsLabel: 'Key judgments',
          metrics: [
            { label: 'Company quality', value: 'Insufficient data', tone: 'positive' },
            { label: 'Valuation', value: 'Insufficient data', tone: 'caution' },
            { label: 'Long-term outlook', value: 'Insufficient data', tone: 'positive' },
          ],
          signals: [
            { label: 'Opportunity', value: 'Insufficient data', tone: 'opportunity' },
            {
              label: 'Risk',
              value: 'Valuation leaves less room for error.',
              tone: 'risk',
            },
          ],
        },
      },
    });
    expect(payload.result).toContain('Durable moat');
    expect(payload.fullText).toContain('Research with evidence.');
    expect(payload.poster.highlights?.[0]?.title).toContain('Platform economics');
  });

  it('maps snake_case conclusion fields into the reference share layout', () => {
    const payload = mapCompanyResearchReportToSharePayload(
      task,
      {
        overall_conclusion: {
          decision: 'BUY',
          confidence_level: 'HIGH',
          company_quality: 'Excellent',
          valuation_status: 'Full',
          long_term_outlook: 'Positive',
          biggest_opportunity: 'Demand expands',
          biggest_risk: 'Valuation compresses',
        },
      },
      shareLabels,
    );

    expect(payload.poster.researchBrief).toMatchObject({
      decision: 'Buy',
      confidence: 'HIGH',
      metrics: [
        { label: 'Company quality', value: 'Excellent', tone: 'positive' },
        { label: 'Valuation', value: 'Full', tone: 'caution' },
        { label: 'Long-term outlook', value: 'Positive', tone: 'positive' },
      ],
      signals: [
        { label: 'Opportunity', value: 'Demand expands', tone: 'opportunity' },
        { label: 'Risk', value: 'Valuation compresses', tone: 'risk' },
      ],
    });
  });

  it('renders localized missing-data labels without leaking raw sentinels', () => {
    const payload = mapCompanyResearchReportToSharePayload(
      {
        ...task,
        conclusion: {
          decision: ' insufficient-data ',
          confidence: 'INSUFFICIENT_DATA',
          companyQuality: 'insufficient data',
          biggestRisk: 'insufficient_data',
        },
      },
      {
        direct_answer: 'The available evidence supports a cautious view.',
        overall_conclusion: {
          decision: 'insufficient_data',
          confidence_level: 'insufficient-data',
          company_quality: 'Strong recurring revenue',
          valuation_status: ' insufficient_data ',
          long_term_outlook: 'Durable',
          biggest_opportunity: 'insufficient data',
          biggest_risk: 'INSUFFICIENT_DATA',
        },
      },
      shareLabels,
    );

    expect(payload.poster.conclusion).toBe('The available evidence supports a cautious view.');
    expect(payload.poster.researchBrief).toMatchObject({
      decision: '',
      confidence: 'Insufficient data',
      metrics: [
        { label: 'Company quality', value: 'Strong recurring revenue', tone: 'positive' },
        { label: 'Valuation', value: 'Insufficient data', tone: 'caution' },
        { label: 'Long-term outlook', value: 'Durable', tone: 'positive' },
      ],
      signals: [
        { label: 'Opportunity', value: 'Insufficient data', tone: 'opportunity' },
        { label: 'Risk', value: 'Insufficient data', tone: 'risk' },
      ],
    });
    expect(JSON.stringify(payload)).not.toMatch(/insufficient[_-]data/i);
  });
});
