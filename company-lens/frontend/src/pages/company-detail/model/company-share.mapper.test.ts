import { describe, expect, it } from 'vitest';

import type {
  CompanyResearchReport,
  CompanyResearchTask,
} from '../../../entities/company-research';
import { mapCompanyTaskToSharePayload } from './company-share.mapper';

describe('company share mapper', () => {
  it('creates a local-only company payload from Task and Report', () => {
    const task: CompanyResearchTask = {
      taskId: 'task-1',
      query: 'Company A',
      status: 'partial',
      reportReady: true,
      companyName: 'Company A',
      stockCode: 'CMPA',
      market: 'US',
      industry: '制药与医疗保健',
      industryZh: '制药与医疗保健',
      industryEn: 'Pharmaceuticals & Healthcare',
      capabilities: [],
    };
    const report: CompanyResearchReport = {
      overall_conclusion: {
        decision: 'HOLD',
        decision_label: 'Watch',
        maximum_risk: 'Company risk',
      },
      direct_answer: 'Company conclusion',
      agent_results: [
        {
          agent_name: 'investment_research_agent',
          report_markdown: '# Investment report\n\nStrong switching costs',
        },
      ],
    };

    expect(
      mapCompanyTaskToSharePayload(
        task,
        report,
        {
          productName: 'AI Berkshire',
          slogan: 'Research with evidence.',
          researchType: 'Company details',
          risk: 'Risks',
        },
        'en-US',
      ),
    ).toMatchObject({
      subjectKind: 'company',
      targetId: 'task-1',
      projectId: 'task-1',
      landingCapability: 'none',
      riskStatement: 'Company risk',
      poster: {
        identity: 'CMPA',
        metadata: ['US', 'Pharmaceuticals & Healthcare', 'Company A'],
      },
    });
  });
});
