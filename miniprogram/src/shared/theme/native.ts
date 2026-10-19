import Taro from '@tarojs/taro';
import type { ThemeMode } from './preferences';
import { nativeThemes } from './native.generated';

export async function syncNativeTheme(mode: ThemeMode, withTabBar: boolean): Promise<void> {
  const theme = nativeThemes[mode];
  const updates = [
    Promise.resolve().then(() =>
      Taro.setNavigationBarColor({
        frontColor: mode === 'dark' ? '#ffffff' : '#000000',
        backgroundColor: theme.navigationBackground,
      }),
    ),
    Promise.resolve().then(() =>
      Taro.setBackgroundColor({
        backgroundColor: theme.background,
        backgroundColorTop: theme.background,
        backgroundColorBottom: theme.background,
      }),
    ),
  ];
  if (withTabBar)
    updates.push(
      Promise.resolve().then(() =>
        Taro.setTabBarStyle({
          color: theme.tabText,
          selectedColor: theme.tabSelected,
          backgroundColor: theme.tabBackground,
          borderStyle: theme.tabBorder,
        }),
      ),
    );
  // 个别调试宿主不支持原生主题 API，保留 theme.json 的系统主题，不产生未处理拒绝。
  await Promise.allSettled(updates);
}
