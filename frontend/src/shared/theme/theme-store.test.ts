import { beforeEach, describe, expect, it } from 'vitest';

import { THEME_STORAGE_KEY, useThemeStore } from './theme-store';

describe('theme preference', () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ mode: 'light' });
  });

  it('keeps the mode from a legacy preset preference', async () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'dark', preset: 'neutral' }, version: 0 }),
    );

    await useThemeStore.persist.rehydrate();

    expect(useThemeStore.getState().mode).toBe('dark');
    useThemeStore.getState().setMode('light');
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY)!).state).toEqual({ mode: 'light' });
  });

  it('ignores an invalid persisted mode', async () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'unknown' }, version: 0 }),
    );

    await useThemeStore.persist.rehydrate();

    expect(useThemeStore.getState().mode).toBe('light');
  });
});
