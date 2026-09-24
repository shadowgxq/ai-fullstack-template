import { useCallback } from 'react';

import { useThemeStore } from './theme-store';

export function useTheme() {
  const mode = useThemeStore((state) => state.mode);
  const preset = useThemeStore((state) => state.preset);
  const setMode = useThemeStore((state) => state.setMode);
  const setPreset = useThemeStore((state) => state.setPreset);

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  return { mode, preset, setMode, setPreset, toggle };
}
