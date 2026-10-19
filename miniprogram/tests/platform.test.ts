import { beforeEach, expect, it, vi } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import Taro from './taro-mock';
import { chooseImage, requestWeChatLoginCode, uploadImage } from '../src/shared/platform/wechat';
import { bindNetworkStatus } from '../src/shared/query/lifecycle';
import { parsePreference, resolveTheme, useThemeStore } from '../src/shared/theme/preferences';
import { syncNativeTheme } from '../src/shared/theme/native';

beforeEach(() => {
  vi.resetAllMocks();
  onlineManager.setOnline(true);
  useThemeStore.setState({ preference: 'system', systemTheme: 'light', storageWarning: null });
  Taro.getAppBaseInfo.mockReturnValue({ theme: 'light' });
});
it('treats cancelled media selection differently from denied permissions', async () => {
  Taro.chooseMedia.mockRejectedValueOnce({ errMsg: 'chooseMedia:fail cancel' });
  await expect(chooseImage()).resolves.toBeNull();
  Taro.chooseMedia.mockRejectedValueOnce({ errMsg: 'chooseMedia:fail auth deny' });
  await expect(chooseImage()).rejects.toThrow('授权');
});
it('returns a local image without uploading it', async () => {
  Taro.chooseMedia.mockResolvedValueOnce({ tempFiles: [{ tempFilePath: 'wxfile://local.jpg' }] });
  await expect(chooseImage()).resolves.toBe('wxfile://local.jpg');
  expect(Taro.uploadFile).not.toHaveBeenCalled();
});
it('obtains a WeChat code, not a product session', async () => {
  Taro.login.mockResolvedValueOnce({ code: 'one-time-code' });
  await expect(requestWeChatLoginCode()).resolves.toBe('one-time-code');
  Taro.login.mockResolvedValueOnce({});
  await expect(requestWeChatLoginCode()).rejects.toThrow();
});
it('checks HTTPS, upload status and JSON separately', async () => {
  const options = { url: 'https://upload.example.test', filePath: 'wxfile://x', name: 'file' };
  await expect(uploadImage({ ...options, url: 'http://example.test' })).rejects.toThrow('HTTPS');
  Taro.uploadFile.mockResolvedValueOnce({ statusCode: 500, data: '{}' });
  await expect(uploadImage(options)).rejects.toThrow('上传失败');
  Taro.uploadFile.mockResolvedValueOnce({ statusCode: 200, data: '<html>' });
  await expect(uploadImage(options)).rejects.toThrow('格式');
  Taro.uploadFile.mockResolvedValueOnce({ statusCode: 200, data: '{"id":"x"}' });
  await expect(uploadImage(options)).resolves.toEqual({ id: 'x' });
});
it('new connectivity events win over a late initial snapshot', async () => {
  let resolveSnapshot!: (value: { networkType: string }) => void;
  Taro.getNetworkType.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSnapshot = resolve;
      }),
  );
  const cleanup = bindNetworkStatus();
  const listener = Taro.onNetworkStatusChange.mock.calls[0][0] as (value: {
    isConnected: boolean;
  }) => void;
  listener({ isConnected: false });
  resolveSnapshot({ networkType: 'wifi' });
  await Promise.resolve();
  expect(onlineManager.isOnline()).toBe(false);
  cleanup();
  expect(Taro.offNetworkStatusChange).toHaveBeenCalledWith(listener);
});
it('does not apply late network results after cleanup', async () => {
  let resolveSnapshot!: (value: { networkType: string }) => void;
  Taro.getNetworkType.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSnapshot = resolve;
      }),
  );
  bindNetworkStatus()();
  resolveSnapshot({ networkType: 'none' });
  await Promise.resolve();
  expect(onlineManager.isOnline()).toBe(true);
});
it('resolves explicit themes independently from system changes', () => {
  expect(parsePreference('unexpected')).toBe('system');
  expect(resolveTheme('dark', 'light')).toBe('dark');
  expect(resolveTheme('system', 'dark')).toBe('dark');
});
it('reports failed theme storage without pretending preference was saved', () => {
  Taro.setStorageSync.mockImplementationOnce(() => {
    throw new Error('storage');
  });
  expect(() => useThemeStore.getState().setPreference('dark')).toThrow();
  expect(useThemeStore.getState().preference).toBe('system');
});
it('only updates a native tab bar on pages that own one', async () => {
  await syncNativeTheme('dark', false);
  expect(Taro.setTabBarStyle).not.toHaveBeenCalled();
  await syncNativeTheme('dark', true);
  expect(Taro.setTabBarStyle).toHaveBeenCalledOnce();
});
it('survives a debug host rejecting native appearance updates', async () => {
  Taro.setNavigationBarColor.mockImplementationOnce(() => {
    throw new Error('unsupported');
  });
  await expect(syncNativeTheme('light', false)).resolves.toBeUndefined();
});
