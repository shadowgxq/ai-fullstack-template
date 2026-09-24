import { describe, expect, it, vi } from 'vitest';

import { AuthError } from './auth.gateway';
import { resolveAuthErrorText } from './auth.error-text';

describe('resolveAuthErrorText', () => {
  it('translates a known domain error code instead of using its server message', () => {
    const t = vi.fn((key: string) => key);

    expect(
      resolveAuthErrorText(new AuthError('INVALID_CODE', 'Invalid verification code'), t),
    ).toBe('auth.errors.INVALID_CODE');
  });

  it('uses the localized system fallback for unknown and transport errors', () => {
    const t = vi.fn((key: string) => key);

    expect(resolveAuthErrorText(new AuthError('generic', 'Internal server error'), t)).toBe(
      'errors.system',
    );
    expect(resolveAuthErrorText(new Error('Network Error'), t)).toBe('errors.system');
    expect(t).not.toHaveBeenCalledWith('auth.errors.generic');
  });
});
