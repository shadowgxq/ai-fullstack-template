import { describe, expect, it } from 'vitest';

import {
  parseCompanyResearchReport,
  parseCompanyResearchReportDocument,
  parseCompanyResearchCapabilityResult,
  parseCompanyResearchHistoryPage,
  parseCompanyResearchRecognition,
  parseCompanyResearchTask,
  parseSuccessPayload,
} from './company-research.dto';
import {
  getCompanyResearchAgentResults,
  getCompanyResearchCapabilitiesSummary,
  getCompanyResearchDirectAnswer,
  getLocalizedCompanyResearchIndustry,
} from '../model/company-research.report';

describe('company research dto', () => {
  it('maps task and normalizes contract variants', () => {
    expect(
      parseCompanyResearchTask({
        taskId: '1874001493837324289',
        query: 'NVIDIA',
        language: 'en-US',
        status: 'SUCCEEDED',
        reportReady: true,
        finalResultAvailable: false,
        synthesisFailed: true,
        exchange: 'NASDAQ',
        keyPeople: 'Jensen Huang (CEO)',
        conclusion: {
          decision: 'HOLD',
          confidence: 'MEDIUM',
          companyQuality: 'EXCELLENT',
          valuationStatus: '偏高',
          longTermOutlook: '积极',
          maximumOpportunity: 'AI infrastructure demand keeps expanding',
          maximumRisk: 'Valuation leaves little room for execution misses',
        },
        capabilities: [
          { name: 'investment_research_agent', status: 'SUCCESS' },
          { name: 'investment_team_agent', status: 'SUCCEEDED', retryable: true },
          { name: 'future_agent', status: 'NEW_STATUS' },
        ],
      }),
    ).toMatchObject({
      taskId: '1874001493837324289',
      language: 'en-US',
      status: 'completed',
      reportReady: true,
      finalResultAvailable: false,
      synthesisFailed: true,
      exchange: 'NASDAQ',
      keyPeople: 'Jensen Huang (CEO)',
      conclusion: {
        decision: 'HOLD',
        confidence: 'MEDIUM',
        companyQuality: 'EXCELLENT',
        valuationStatus: '偏高',
        longTermOutlook: '积极',
        biggestOpportunity: 'AI infrastructure demand keeps expanding',
        biggestRisk: 'Valuation leaves little room for execution misses',
      },
      capabilities: [
        { status: 'succeeded' },
        { status: 'succeeded', retryable: true },
        { status: 'unknown' },
      ],
    });
  });

  it('keeps legacy conclusion opportunity and risk aliases compatible', () => {
    expect(
      parseCompanyResearchTask({
        taskId: 'task-legacy-conclusion',
        query: 'Legacy task',
        status: 'SUCCEEDED',
        conclusion: {
          maximum_opportunity: 'Legacy opportunity',
          biggest_risk: 'Legacy risk',
        },
      }).conclusion,
    ).toEqual({
      decision: undefined,
      confidence: undefined,
      companyQuality: undefined,
      valuationStatus: undefined,
      longTermOutlook: undefined,
      biggestOpportunity: 'Legacy opportunity',
      biggestRisk: 'Legacy risk',
    });
  });

  it('keeps bilingual task industry and conclusion fields from product service', () => {
    expect(
      parseCompanyResearchTask({
        taskId: 'task-bilingual-fields',
        query: 'NVIDIA',
        status: 'SUCCEEDED',
        industry: 'Semiconductors',
        industryZh: '半导体',
        industryEn: 'Semiconductors',
        conclusion: {
          maximumOpportunity: 'AI infrastructure demand may drive upside.',
          maximumOpportunityZh: 'AI 基础设施需求可能带来上行空间。',
          maximumOpportunityEn: 'AI infrastructure demand may drive upside.',
          maximumRisk: 'Valuation and competition may reduce returns.',
          maximumRiskZh: '估值和竞争可能降低回报。',
          maximumRiskEn: 'Valuation and competition may reduce returns.',
        },
      }),
    ).toMatchObject({
      industry: 'Semiconductors',
      industryZh: '半导体',
      industryEn: 'Semiconductors',
      conclusion: {
        biggestOpportunity: 'AI infrastructure demand may drive upside.',
        biggestOpportunityZh: 'AI 基础设施需求可能带来上行空间。',
        biggestOpportunityEn: 'AI infrastructure demand may drive upside.',
        biggestRisk: 'Valuation and competition may reduce returns.',
        biggestRiskZh: '估值和竞争可能降低回报。',
        biggestRiskEn: 'Valuation and competition may reduce returns.',
      },
    });
  });

  it('normalizes V1.1 partial and cancelled task statuses', () => {
    expect(
      parseCompanyResearchTask({ taskId: 'task-1', query: 'A', status: 'PARTIAL_FAILED' }).status,
    ).toBe('partial');
    expect(
      parseCompanyResearchTask({ taskId: 'task-2', query: 'B', status: 'CANCELLED' }).status,
    ).toBe('cancelled');
  });

  it('parses V1.3 conversation messages and derives capabilities from Agent blocks', () => {
    const task = parseCompanyResearchTask({
      taskId: 42,
      query: 'NVIDIA',
      status: 'ANALYZING',
      agents: [
        {
          agentRunId: 9001,
          agentName: 'investment_research',
          displayName: 'Investment research',
          skillName: 'investment-research',
          eventAgentName: 'investment_research_agent',
          status: 'RUNNING',
          progress: '45',
          messages: [
            {
              id: 7001,
              conversationId: 8001,
              projectId: '42',
              agentRunId: '9001',
              role: 'assistant',
              content: 'Collecting public filings',
              contentType: 'TEXT',
              stage: 'THINKING',
              seq: '4',
              metadata: '[{"title":"Sources","summary":"Annual report"}]',
            },
          ],
        },
      ],
      systemMessages: [
        {
          id: 7000,
          conversationId: 8001,
          role: 'system',
          content: 'Task created',
          stage: 'TASK_CREATED',
          seq: 1,
          metadata: '{"recognitionId":"recognition-1"}',
        },
      ],
    });

    expect(task).toMatchObject({
      taskId: '42',
      capabilities: [
        {
          name: 'investment_research',
          status: 'running',
        },
      ],
      systemMessages: [
        {
          id: '7000',
          conversationId: '8001',
          seq: 1,
          metadata: { recognitionId: 'recognition-1' },
        },
      ],
      agents: [
        {
          agentRunId: '9001',
          progress: 45,
          messages: [
            {
              id: '7001',
              seq: 4,
              metadata: [{ title: 'Sources', summary: 'Annual report' }],
            },
          ],
        },
      ],
    });
  });

  it('keeps a recursive JSON report without inventing its inner schema', () => {
    expect(
      parseCompanyResearchReport({
        overall_conclusion: { decision: 'BUY', reasons: ['moat', { confidence: 0.8 }] },
      }),
    ).toEqual({
      overall_conclusion: { decision: 'BUY', reasons: ['moat', { confidence: 0.8 }] },
    });
  });

  it('parses the V1.5 report document and keeps bare reports compatible', () => {
    expect(
      parseCompanyResearchReportDocument({
        report: {
          overallConclusion: { decision: 'HOLD' },
          directAnswer: { reason: 'Wait for a wider margin of safety.' },
        },
        reportMarkdown: '# Research report',
      }),
    ).toEqual({
      report: {
        overallConclusion: { decision: 'HOLD' },
        directAnswer: { reason: 'Wait for a wider margin of safety.' },
      },
      reportMarkdown: '# Research report',
    });
    expect(parseCompanyResearchReportDocument({ direct_answer: 'Legacy report' })).toEqual({
      report: { direct_answer: 'Legacy report' },
    });
  });

  it('accepts both current bare success data and a future Result envelope', () => {
    const task = {
      taskId: 'task-1',
      query: 'NVIDIA',
      status: 'PENDING',
    };

    expect(parseSuccessPayload(task, parseCompanyResearchTask).taskId).toBe('task-1');
    expect(
      parseSuccessPayload({ code: 200, message: 'success', data: task }, parseCompanyResearchTask)
        .taskId,
    ).toBe('task-1');
  });

  it('extracts the current product-server report shape', () => {
    const report = parseCompanyResearchReport({
      direct_answer: 'Direct answer',
      capabilities_summary: { investment_research: 'SUCCEEDED' },
      agent_results: [
        {
          agent_name: 'synthesis_agent',
          report_markdown: '# Research report',
          normalized_output: { decision: 'HOLD' },
        },
      ],
    });

    expect(getCompanyResearchDirectAnswer(report)).toBe('Direct answer');
    expect(getCompanyResearchCapabilitiesSummary(report)).toEqual({
      investment_research: 'SUCCEEDED',
    });
    expect(getCompanyResearchAgentResults(report)).toEqual([
      {
        agentName: 'synthesis_agent',
        reportMarkdown: '# Research report',
        normalizedOutput: { decision: 'HOLD' },
      },
    ]);
  });

  it('extracts V1.5 camelCase direct answer text', () => {
    const report = parseCompanyResearchReport({
      overallConclusion: { decision: 'HOLD' },
      directAnswer: {
        recommendation: 'HOLD',
        reason: 'The available evidence is incomplete.',
      },
    });

    expect(getCompanyResearchDirectAnswer(report)).toBe('The available evidence is incomplete.');
  });

  it('selects the direct answer reason for the active report language', () => {
    const report = parseCompanyResearchReport({
      directAnswer: {
        reason: '四个研究角色均给出 HOLD。',
        reasonZh: '四个研究角色均给出 HOLD，且当前无法完成完整财务交叉验证和合理价值计算。',
        reasonEn:
          'All four research roles rate it HOLD, and a complete financial cross-verification and fair value calculation cannot currently be completed.',
      },
    });

    expect(getCompanyResearchDirectAnswer(report, 'zh-CN')).toBe(
      '四个研究角色均给出 HOLD，且当前无法完成完整财务交叉验证和合理价值计算。',
    );
    expect(getCompanyResearchDirectAnswer(report, 'en-US')).toBe(
      'All four research roles rate it HOLD, and a complete financial cross-verification and fair value calculation cannot currently be completed.',
    );
  });

  it('maps a duplicated Chinese industry value through the locale resources', () => {
    expect(
      getLocalizedCompanyResearchIndustry('en-US', '光通信设备', '光通信设备', '光通信设备'),
    ).toBe('Optical communication equipment');
    expect(
      getLocalizedCompanyResearchIndustry('zh-CN', '光通信设备', '光通信设备', '光通信设备'),
    ).toBe('光通信设备');
  });

  it('normalizes all recognition outcomes and limits ambiguity candidates to five', () => {
    const candidates = Array.from({ length: 7 }, (_, index) => ({
      candidateId: `candidate-${index}`,
      objectName: `Company ${index}`,
      canResearch: index !== 1,
      disabledReason: index === 1 ? 'Not listed' : undefined,
    }));
    const ambiguous = parseCompanyResearchRecognition({
      recognitionId: 'rec-1',
      status: 'AMBIGUOUS',
      candidates,
    });
    expect(ambiguous.status).toBe('ambiguous');
    expect(ambiguous.candidates[0]).toMatchObject({ canResearch: true });
    expect(ambiguous.candidates[1]).toMatchObject({
      canResearch: false,
      disabledReason: 'Not listed',
    });
    expect(
      parseCompanyResearchRecognition({ recognitionId: 'rec-2', status: 'UNSUPPORTED' }).status,
    ).toBe('unsupported');
    expect(
      parseCompanyResearchRecognition({ recognitionId: 'rec-3', status: 'UNRESOLVED' }).status,
    ).toBe('unresolved');
    expect(
      parseCompanyResearchRecognition({ recognitionId: 'rec-4', status: 'FUTURE' }).status,
    ).toBe('unknown');
    expect(
      parseCompanyResearchRecognition({ recognitionId: 'rec-1', status: 'AMBIGUOUS', candidates })
        .candidates,
    ).toHaveLength(5);
  });

  it('maps the V1.1 nested company candidate contract', () => {
    const result = parseCompanyResearchRecognition({
      recognitionId: 'rec-1',
      status: 'RESOLVED',
      selectedCandidateId: 'candidate-1',
      conversationId: 8001,
      candidates: [
        {
          candidateId: 'candidate-1',
          objectName: '黄仁勋',
          normalizedObjectName: 'Jensen Huang',
          researchable: false,
          unsupportedReason: 'Not listed',
          company: {
            name: 'NVIDIA',
            legalName: 'NVIDIA Corporation',
            ticker: 'NVDA',
            market: 'US',
            exchange: 'NASDAQ',
            industry: 'Semiconductors',
            keyPeople: 'Jensen Huang (CEO)',
          },
        },
      ],
    });

    expect(result.candidates[0]).toMatchObject({
      normalizedObjectName: 'Jensen Huang',
      companyName: 'NVIDIA',
      companyLegalName: 'NVIDIA Corporation',
      stockCode: 'NVDA',
      market: 'US',
      exchange: 'NASDAQ',
      industry: 'Semiconductors',
      keyPeople: 'Jensen Huang (CEO)',
      canResearch: false,
      disabledReason: 'Not listed',
    });
    expect(result.conversationId).toBe('8001');
  });

  it('maps the snake_case recognition payload returned by the runner', () => {
    const result = parseCompanyResearchRecognition({
      recognition_id: 'rec-runner-1',
      status: 'AMBIGUOUS',
      conversation_id: 8002,
      candidates: [
        {
          candidate_id: 'candidate-tsla',
          object_type: 'person',
          object_name: '马斯克',
          normalized_object_name: 'Elon Musk',
          is_researchable: true,
          relation: 'management',
          company: {
            name: 'Tesla',
            legal_name: 'Tesla, Inc.',
            ticker: 'TSLA',
            market: 'US',
            exchange: 'NASDAQ',
            industry: '新能源汽车 / 能源',
            key_people: [{ name: 'Elon Musk', role: 'CEO' }],
          },
        },
      ],
    });

    expect(result).toMatchObject({
      recognitionId: 'rec-runner-1',
      conversationId: '8002',
      candidates: [
        {
          candidateId: 'candidate-tsla',
          objectName: '马斯克',
          normalizedObjectName: 'Elon Musk',
          companyName: 'Tesla',
          companyLegalName: 'Tesla, Inc.',
          stockCode: 'TSLA',
          market: 'US',
          exchange: 'NASDAQ',
          industry: '新能源汽车 / 能源',
          keyPeople: 'Elon Musk (CEO)',
          canResearch: true,
        },
      ],
    });
  });

  it('parses JSON strings from a capability result at the DTO boundary', () => {
    expect(
      parseCompanyResearchCapabilityResult({
        agentName: 'investment_research',
        reportReady: true,
        reportMarkdown: '# Report',
        normalizedOutput: '{"decision":"BUY"}',
        sources: '[{"url":"https://example.com"}]',
      }),
    ).toEqual({
      agentName: 'investment_research',
      reportReady: true,
      reportMarkdown: '# Report',
      normalizedOutput: { decision: 'BUY' },
      sources: [{ url: 'https://example.com' }],
    });
  });

  it('keeps unknown language values safe and honors explicit reportReady=false', () => {
    expect(
      parseCompanyResearchTask({ taskId: 'task-unknown-language', query: 'A', language: 'fr-FR' })
        .language,
    ).toBe('unknown');
    expect(
      parseCompanyResearchCapabilityResult({
        agentName: 'investment_team',
        reportReady: false,
        reportMarkdown: '# stale payload',
      }),
    ).toMatchObject({ reportReady: false });
  });

  it('does not expose specialist normalized output as a unified report section', () => {
    expect(
      getCompanyResearchAgentResults({
        agent_results: [
          {
            agent_name: 'investment_research_agent',
            report_markdown: '# Research report',
            normalized_output: { researchability: 'listed' },
          },
        ],
      }),
    ).toEqual([
      {
        agentName: 'investment_research_agent',
        reportMarkdown: '# Research report',
      },
    ]);
  });

  it('parses history pagination while preserving string ids and unknown task status', () => {
    expect(
      parseCompanyResearchHistoryPage({
        content: [{ taskId: '90071992547409931234', query: 'NVDA', status: 'FUTURE' }],
        page: 3,
        size: 20,
        total: 41,
      }),
    ).toEqual({
      items: [
        {
          taskId: '90071992547409931234',
          query: 'NVDA',
          status: 'unknown',
          conclusion: undefined,
          objectName: undefined,
          objectType: undefined,
          companyName: undefined,
          stockCode: undefined,
          market: undefined,
          researchFocus: undefined,
          createdAt: undefined,
        },
      ],
      page: 3,
      size: 20,
      total: 41,
    });
  });
});
