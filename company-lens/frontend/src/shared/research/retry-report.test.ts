import { describe, expect, it } from 'vitest';

import { canRetryFinalReport } from './retry-report';

describe('canRetryFinalReport', () => {
  it('allows synthesis retry only when all three agents succeeded', () => {
    expect(
      canRetryFinalReport({
        status: 'FAILED',
        agents: [
          { agentName: 'company_profile', status: 'SUCCEEDED' },
          { agentName: 'business_analysis', status: 'SUCCEEDED' },
          { agentName: 'financial_analysis', status: 'SUCCEEDED' },
        ],
        finalResultAvailable: false,
        synthesisFailed: true,
      }),
    ).toBe(true);
  });

  it('uses history capabilities when detail agents are not present', () => {
    expect(
      canRetryFinalReport({
        status: 'FAILED',
        capabilities: [
          { name: 'company_profile', status: 'succeeded' },
          { name: 'business_analysis', status: 'succeeded' },
          { name: 'financial_analysis', status: 'succeeded' },
        ],
        finalResultAvailable: false,
        synthesisFailed: true,
      }),
    ).toBe(true);
  });

  it('does not treat a legacy synthesis sentinel as a failed research Agent', () => {
    expect(
      canRetryFinalReport({
        status: 'FAILED',
        capabilities: [
          { name: 'company_profile', status: 'SUCCEEDED' },
          { name: 'business_analysis', status: 'SUCCEEDED' },
          { name: 'financial_analysis', status: 'SUCCEEDED' },
          { name: 'synthesis', status: 'FAILED' },
        ],
        finalResultAvailable: false,
        synthesisFailed: true,
      }),
    ).toBe(true);
  });

  it.each([
    ['a failed agent', { status: 'FAILED' as const }],
    ['a ready final report', { status: 'SUCCEEDED' as const }],
  ])('rejects report retry when %s', (_reason, override) => {
    expect(
      canRetryFinalReport({
        status: override.status,
        capabilities: [
          { name: 'company_profile', status: 'SUCCEEDED' },
          { name: 'business_analysis', status: 'FAILED' },
          { name: 'financial_analysis', status: 'SUCCEEDED' },
        ],
        finalResultAvailable: false,
        synthesisFailed: true,
      }),
    ).toBe(false);
  });

  it('rejects a non-synthesis failure or an available report', () => {
    const input = {
      status: 'FAILED',
      capabilities: [
        { name: 'company_profile', status: 'SUCCEEDED' },
        { name: 'business_analysis', status: 'SUCCEEDED' },
        { name: 'financial_analysis', status: 'SUCCEEDED' },
      ],
      finalResultAvailable: false,
      synthesisFailed: true,
    } as const;

    expect(canRetryFinalReport({ ...input, synthesisFailed: false })).toBe(false);
    expect(canRetryFinalReport({ ...input, finalResultAvailable: true })).toBe(false);
  });
});
