import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark';
export const THEME_PRESETS = ['signal', 'neutral'] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

/** localStorage key（与 index.html 防闪烁脚本保持一致）。 */
export const THEME_STORAGE_KEY = 'ui-theme';

type ThemeState = {
  mode: ThemeMode;
  preset: ThemePreset;
  setMode: (mode: ThemeMode) => void;
  setPreset: (preset: ThemePreset) => void;
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

function isThemePreset(value: unknown): value is ThemePreset {
  return typeof value === 'string' && (THEME_PRESETS as readonly string[]).includes(value);
}

function getPreferredThemeMode(): ThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: getPreferredThemeMode(),
      preset: 'signal',
      setMode: (mode) => set({ mode }),
      setPreset: (preset) => set({ preset }),
    }),
    {
      name: THEME_STORAGE_KEY,
      merge: (persistedState, currentState) => {
        const persistedMode =
          typeof persistedState === 'object' && persistedState !== null && 'mode' in persistedState
            ? persistedState.mode
            : undefined;
        const persistedPreset =
          typeof persistedState === 'object' &&
          persistedState !== null &&
          'preset' in persistedState
            ? persistedState.preset
            : undefined;

        return {
          ...currentState,
          mode: isThemeMode(persistedMode) ? persistedMode : currentState.mode,
          preset: isThemePreset(persistedPreset) ? persistedPreset : currentState.preset,
        };
      },
    },
  ),
);
