import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// vitest 未开启 globals，React Testing Library 无法自行注册 afterEach，
// 不显式 cleanup 的话同一文件内多个用例的 DOM 会累积，导致 getByRole 撞到多个元素。
afterEach(() => {
  cleanup();
});

// jsdom 不实现 matchMedia；为 shared/theme 提供最小 mock。
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
