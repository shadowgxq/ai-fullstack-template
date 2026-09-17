import { describe, expect, it } from 'vitest';

import { maskEmail } from './maskEmail';

describe('maskEmail', () => {
  it('保留首尾字符，遮住中间', () => {
    expect(maskEmail('demo@example.com')).toBe('d***o@example.com');
  });

  it('本地部分太短时只保留首字符，不再露尾', () => {
    expect(maskEmail('ab@x.com')).toBe('a***@x.com');
    expect(maskEmail('a@x.com')).toBe('a***@x.com');
  });

  it('结构不完整时原样返回，交给上游校验', () => {
    expect(maskEmail('not-an-email')).toBe('not-an-email');
    expect(maskEmail('@example.com')).toBe('@example.com');
    expect(maskEmail('demo@')).toBe('demo@');
  });
});
