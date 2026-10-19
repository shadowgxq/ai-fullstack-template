import { beforeEach, expect, it, vi } from 'vitest';
import Taro from './taro-mock';
import { syncNativeTheme } from '../src/shared/theme/native';
import { nativeThemes } from '../src/shared/theme/native.generated';

beforeEach(() => vi.resetAllMocks());

it.each(['light', 'dark'] as const)('syncs %s native colors and icon pairs', async (mode) => {
  const theme = nativeThemes[mode];
  await syncNativeTheme(mode, true);
  expect(Taro.setTabBarStyle).toHaveBeenCalledWith({
    color: theme.tabText,
    selectedColor: theme.tabSelected,
    backgroundColor: theme.tabBackground,
    borderStyle: theme.tabBorder,
  });
  const icons = [
    [theme.tabHomeIcon, theme.tabHomeSelectedIcon],
    [theme.tabComponentsIcon, theme.tabComponentsSelectedIcon],
    [theme.tabProfileIcon, theme.tabProfileSelectedIcon],
  ];
  expect(Taro.setTabBarItem).toHaveBeenCalledTimes(3);
  icons.forEach(([iconPath, selectedIconPath], index) => {
    expect(Taro.setTabBarItem).toHaveBeenNthCalledWith(index + 1, {
      index,
      iconPath,
      selectedIconPath,
    });
  });
});

it('does not update tab icons or colors from non-tab pages', async () => {
  await syncNativeTheme('dark', false);
  expect(Taro.setNavigationBarColor).toHaveBeenCalledOnce();
  expect(Taro.setTabBarStyle).not.toHaveBeenCalled();
  expect(Taro.setTabBarItem).not.toHaveBeenCalled();
});

it('does not let one rejected icon prevent other icons or subsequent updates', async () => {
  Taro.setTabBarItem.mockRejectedValueOnce(new Error('unsupported'));
  await expect(syncNativeTheme('light', true)).resolves.toBeUndefined();
  expect(Taro.setTabBarItem).toHaveBeenCalledTimes(3);
  await expect(syncNativeTheme('dark', true)).resolves.toBeUndefined();
  expect(Taro.setTabBarItem).toHaveBeenCalledTimes(6);
});

it('does not drop a tab update when a non-tab page queues an appearance update', async () => {
  await Promise.all([syncNativeTheme('dark', true), syncNativeTheme('dark', false)]);
  expect(Taro.setNavigationBarColor).toHaveBeenCalledTimes(2);
  expect(Taro.setTabBarItem).toHaveBeenCalledTimes(3);
  expect(Taro.setTabBarItem).toHaveBeenNthCalledWith(1, {
    index: 0,
    iconPath: nativeThemes.dark.tabHomeIcon,
    selectedIconPath: nativeThemes.dark.tabHomeSelectedIcon,
  });
});

it('applies the latest theme after an in-flight native update, not concurrently', async () => {
  let release!: () => void;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  Taro.setTabBarStyle.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = () => resolve({});
        markStarted();
      }),
  );
  const first = syncNativeTheme('light', true);
  await started;
  const latest = syncNativeTheme('dark', true);
  await Promise.resolve();
  expect(Taro.setTabBarStyle).toHaveBeenCalledOnce();
  release();
  await Promise.all([first, latest]);
  expect(Taro.setTabBarStyle).toHaveBeenCalledTimes(2);
  expect(Taro.setTabBarItem).toHaveBeenCalledTimes(6);
  expect(Taro.setTabBarItem).toHaveBeenNthCalledWith(6, {
    index: 2,
    iconPath: nativeThemes.dark.tabProfileIcon,
    selectedIconPath: nativeThemes.dark.tabProfileSelectedIcon,
  });
});
