import { describe, expect, it } from 'vitest';

import {
  getLocalizedOverallConclusionField,
  getCompanyResearchSourceItems,
  getOverallConclusionField,
  isCompanyResearchSummaryAgentName,
} from './company-research.report';

describe('company research report helpers', () => {
  it('maps source strings and source records into link-ready list items', () => {
    expect(
      getCompanyResearchSourceItems([
        'https://example.com/filing',
        {
          title: 'Annual report',
          url: 'https://example.com/annual-report',
          summary: 'FY2025 filing',
        },
      ]),
    ).toEqual([
      {
        label: 'https://example.com/filing',
        url: 'https://example.com/filing',
      },
      {
        label: 'Annual report',
        url: 'https://example.com/annual-report',
        detail: 'FY2025 filing',
      },
    ]);
  });

  it('recognizes summary agent aliases but not specialist agents', () => {
    expect(isCompanyResearchSummaryAgentName('synthesis')).toBe(true);
    expect(isCompanyResearchSummaryAgentName('decision_aggregator_agent')).toBe(true);
    expect(isCompanyResearchSummaryAgentName('investment_research')).toBe(false);
  });

  it('treats insufficient-data conclusion fields as missing', () => {
    const report = {
      overall_conclusion: {
        company_quality: ' Strong recurring revenue ',
        valuation_status: 'insufficient_data',
        biggest_opportunity: ' INSUFFICIENT-DATA ',
      },
    };

    expect(getOverallConclusionField(report, 'company_quality')).toBe('Strong recurring revenue');
    expect(getOverallConclusionField(report, 'valuation_status')).toBeUndefined();
    expect(getOverallConclusionField(report, 'biggest_opportunity')).toBeUndefined();
  });

  it('selects overall conclusion opportunity and risk by active language with fallback', () => {
    const report = {
      overallConclusion: {
        maximumOpportunity: 'Legacy opportunity fallback',
        maximumOpportunityZh: 'AI 基础设施需求可能带来上行空间。',
        maximumOpportunityEn: 'AI infrastructure demand may drive upside.',
        maximumRisk: 'Legacy risk fallback',
        maximumRiskZh: '估值和竞争可能降低回报。',
      },
    };

    expect(getLocalizedOverallConclusionField(report, 'maximumOpportunity', 'zh-CN')).toBe(
      'AI 基础设施需求可能带来上行空间。',
    );
    expect(getLocalizedOverallConclusionField(report, 'maximumOpportunity', 'en-US')).toBe(
      'AI infrastructure demand may drive upside.',
    );
    expect(getLocalizedOverallConclusionField(report, 'maximumRisk', 'zh-CN')).toBe(
      '估值和竞争可能降低回报。',
    );
    expect(getLocalizedOverallConclusionField(report, 'maximumRisk', 'en-US')).toBe(
      'Legacy risk fallback',
    );
  });
});
