import { describe, expect, it } from 'vitest';

import { PASSWORD_MIN_LENGTH, validatePassword, validateUsername } from './auth.validation';

describe('actual backend credential limits', () => {
  it('accepts existing short passwords without inventing a stronger backend policy', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(1);
    expect(validatePassword('x')).toBeNull();
    expect(validatePassword('')).not.toBeNull();
  });

  it('applies the password limit to UTF-8 bytes, without truncation', () => {
    expect(validatePassword('x'.repeat(72))).toBeNull();
    expect(validatePassword('x'.repeat(73))).not.toBeNull();
    expect(validatePassword('密'.repeat(24))).toBeNull();
    expect(validatePassword('密'.repeat(25))).not.toBeNull();
  });

  it('counts username code points and rejects whitespace-only input', () => {
    expect(validateUsername('名'.repeat(50))).toBeNull();
    expect(validateUsername('名'.repeat(51))).not.toBeNull();
    expect(validateUsername('  ')).not.toBeNull();
    expect(validateUsername('alice_9f2c')).toBeNull();
  });
});
