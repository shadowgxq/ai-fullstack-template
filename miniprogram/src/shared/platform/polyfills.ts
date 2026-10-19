import { AbortController, AbortSignal } from 'abort-controller';

// TanStack Query 在每次请求中创建 AbortController；小程序宿主不保证提供它。
if (typeof globalThis.AbortController === 'undefined') {
  Object.defineProperty(globalThis, 'AbortController', {
    value: AbortController,
    configurable: true,
    writable: true,
  });
}
if (typeof globalThis.AbortSignal === 'undefined') {
  Object.defineProperty(globalThis, 'AbortSignal', {
    value: AbortSignal,
    configurable: true,
    writable: true,
  });
}
