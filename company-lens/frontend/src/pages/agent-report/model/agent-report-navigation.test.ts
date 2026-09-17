import { describe, expect, it } from 'vitest';

import { getAgentReportReturnPath } from './agent-report-navigation';

describe('Agent report navigation', () => {
  it('returns to the internal source route when it is present', () => {
    expect(
      getAgentReportReturnPath(
        { returnTo: '/research/task-1/progress' },
        '/research/task-1/result',
      ),
    ).toBe('/research/task-1/progress');
  });

  it('falls back for missing or external state', () => {
    expect(getAgentReportReturnPath(undefined, '/research/task-1/result')).toBe(
      '/research/task-1/result',
    );
    expect(getAgentReportReturnPath({ returnTo: 'https://example.com' }, '/research/task-1/result')).toBe(
      '/research/task-1/result',
    );
  });
});
