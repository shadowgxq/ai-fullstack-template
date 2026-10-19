import Taro from '@tarojs/taro';
import type { ThemeMode } from './preferences';
import { nativeThemes } from './native.generated';

let appearanceQueue: Promise<void> = Promise.resolve();

export async function syncNativeTheme(mode: ThemeMode, withTabBar: boolean): Promise<void> {
  const apply = async () => {
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
    if (withTabBar) {
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
      const icons = [
        [theme.tabHomeIcon, theme.tabHomeSelectedIcon],
        [theme.tabComponentsIcon, theme.tabComponentsSelectedIcon],
        [theme.tabProfileIcon, theme.tabProfileSelectedIcon],
      ];
      icons.forEach(([iconPath, selectedIconPath], index) => {
        updates.push(
          Promise.resolve().then(() => Taro.setTabBarItem({ index, iconPath, selectedIconPath })),
        );
      });
    }
    // 调试宿主可能拒绝个别原生 API，失败不能阻止其余样式或后续主题同步。
    await Promise.allSettled(updates);
  };
  // 等待上一组原生调用完成，防止快速切换主题时旧图标迟到覆盖最新外观。
  appearanceQueue = appearanceQueue.then(apply, apply);
  await appearanceQueue;
}
