import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('../api', () => ({ request: requestMock }));

import { trackVisit } from './track-visit';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('trackVisit', () => {
  beforeEach(() => {
    localStorage.clear();
    requestMock.mockReset();
  });

  // it('首次进入上报一次访问到 /v1/analytics/visit', () => {
  //   requestMock.mockResolvedValue(undefined);

  //   trackVisit();

  //   expect(requestMock).toHaveBeenCalledTimes(1);
  //   expect(requestMock).toHaveBeenCalledWith({ method: 'POST', url: '/v1/analytics/visit' });
  // });

  it('上报成功后当天不再重复上报', async () => {
    requestMock.mockResolvedValue(undefined);

    trackVisit();
    await flush();
    trackVisit();

    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('上报失败则不写标记，下次进入自动重试', async () => {
    requestMock.mockRejectedValue(new Error('network'));

    trackVisit();
    await flush();
    trackVisit();

    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it('上报失败不抛出异常（fire-and-forget）', () => {
    requestMock.mockRejectedValue(new Error('boom'));

    expect(() => trackVisit()).not.toThrow();
  });
});
