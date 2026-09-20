import { afterEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, useThemeStore } from './theme-store';
import { LOCALE_STORAGE_KEY, useLocaleStore } from '../i18n';
afterEach(() => {
  localStorage.clear();
  useThemeStore.setState({ mode: 'light', preset: 'signal' });
  useLocaleStore.setState({ locale: 'en' });
});
describe('persisted preferences', () => {
  it('hydrates legacy mode-only preferences without losing the default preset', async () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'dark' }, version: 0 }),
    );
    await useThemeStore.persist.rehydrate();
    expect(useThemeStore.getState()).toMatchObject({ mode: 'dark', preset: 'signal' });
  });
  it('rejects unknown persisted themes and languages', async () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'invalid', preset: 'invalid' }, version: 0 }),
    );
    await useThemeStore.persist.rehydrate();
    expect(useThemeStore.getState()).toMatchObject({ mode: 'light', preset: 'signal' });
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify({ state: { locale: 'invalid' }, version: 0 }),
    );
    await useLocaleStore.persist.rehydrate();
    expect(useLocaleStore.getState().locale).toBe('en');
  });
  it('persists the chosen preset alongside mode', () => {
    useThemeStore.getState().setPreset('neutral');
    useThemeStore.getState().setMode('dark');
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY)!).state).toEqual({
      mode: 'dark',
      preset: 'neutral',
    });
  });
});
