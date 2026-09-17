import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark';

/** localStorage key（与 index.html 防闪烁脚本保持一致）。 */
export const THEME_STORAGE_KEY = 'ui-theme';

type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

/** 产品默认浅色（与 index.html 防闪烁脚本一致）；用户显式切换后以持久化选择为准。 */
const DEFAULT_THEME_MODE: ThemeMode = 'light';

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: DEFAULT_THEME_MODE,
      setMode: (mode) => set({ mode }),
    }),
    {
      name: THEME_STORAGE_KEY,
      merge: (persistedState, currentState) => {
        const persistedMode =
          typeof persistedState === 'object' && persistedState !== null && 'mode' in persistedState
            ? persistedState.mode
            : undefined;

        return {
          ...currentState,
          mode: isThemeMode(persistedMode) ? persistedMode : currentState.mode,
        };
      },
    },
  ),
);
