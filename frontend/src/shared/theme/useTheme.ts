import { useCallback } from 'react';

import { useThemeStore } from './theme-store';

export function useTheme() {
  const preset = useThemeStore((state) => state.preset);
  const setPreset = useThemeStore((state) => state.setPreset);
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  return { mode, setMode, toggle, preset, setPreset };
}
