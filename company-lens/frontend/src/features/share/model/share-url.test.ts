import { afterEach, describe, expect, it } from 'vitest';

import { getCurrentPageShareUrl } from './share-url';

const originalUrl = window.location.href;

afterEach(() => {
  window.history.replaceState({}, '', originalUrl);
});

describe('current page share URL', () => {
  it('preserves the route and query while removing the in-page hash', () => {
    window.history.replaceState(
      {},
      '',
      '/research/project-1/result?market=US#research-conclusion-%E8%A1%8C%E4%B8%9A',
    );

    expect(getCurrentPageShareUrl()).toBe(
      `${window.location.origin}/research/project-1/result?market=US`,
    );
  });
});
