import Taro from '@tarojs/taro';
import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';
const storageKey = 'fullstack.miniprogram.theme.v1';

export function parsePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}
export function resolveTheme(preference: ThemePreference, systemTheme: ThemeMode): ThemeMode {
  return preference === 'system' ? systemTheme : preference;
}
interface ThemeState {
  preference: ThemePreference;
  systemTheme: ThemeMode;
  storageWarning: string | null;
  hydrate: () => void;
  setPreference: (value: ThemePreference) => void;
  setSystemTheme: (value: ThemeMode) => void;
}
export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  systemTheme: 'light',
  storageWarning: null,
  hydrate() {
    try {
      set({ preference: parsePreference(Taro.getStorageSync(storageKey)), storageWarning: null });
    } catch {
      set({ preference: 'system', storageWarning: '无法读取外观设置，暂时跟随系统' });
    }
    const theme = Taro.getAppBaseInfo().theme;
    set({ systemTheme: theme === 'dark' ? 'dark' : 'light' });
  },
  setPreference(preference) {
    Taro.setStorageSync(storageKey, preference);
    set({ preference, storageWarning: null });
  },
  setSystemTheme(systemTheme) {
    set({ systemTheme });
  },
}));

export function useTheme(): ThemeMode {
  return useThemeStore((state) => resolveTheme(state.preference, state.systemTheme));
}
