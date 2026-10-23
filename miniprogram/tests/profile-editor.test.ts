// @vitest-environment jsdom
import { createRequire } from 'node:module';
import { act, createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthToken, getAuthSession, saveAuthSession } from '../src/shared/api/auth-token';
import { queryClient, sessionQueryKey } from '../src/shared/query/client';
import type { Profile } from '../src/shared/api/gateway';

const gateway = vi.hoisted(() => ({ patchProfile: vi.fn(), profile: vi.fn() }));
vi.mock('../src/shared/api/gateway', () => ({ api: gateway }));
vi.mock('@tarojs/components', () => ({ Text: 'span', View: 'div' }));
vi.mock('../src/shared/ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    loading,
  }: {
    children?: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => createElement('button', { onClick, disabled: disabled || loading }, children),
  Notice: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}));
vi.mock('../src/features/wardrobe/Page', () => ({
  WardrobePage: ({ children, title }: { children?: ReactNode; title: string }) =>
    createElement('main', null, title, children),
}));
vi.mock('../src/features/profile/Avatar', () => ({ Avatar: () => null }));
vi.mock('../src/features/profile/ProfileForm', () => ({
  ProfileForm: ({
    draft,
    disabled,
    error,
    onNickname,
  }: {
    draft: { nickname: string };
    disabled: boolean;
    error: string | null;
    onNickname: (value: string) => void;
  }) =>
    createElement(
      'div',
      null,
      createElement('input', {
        value: draft.nickname,
        disabled,
        onChange: (event: { target: { value: string } }) => onNickname(event.target.value),
      }),
      error,
    ),
}));
import { ProfileEditor } from '../src/features/profile/ProfileEditor';

const { createRoot } = createRequire(import.meta.url)('react-dom/client') as {
  createRoot: (node: HTMLElement) => { render: (node: ReactNode) => void; unmount: () => void };
};
const initial: Profile = {
  user_id: 1,
  version: 1,
  nickname: '原昵称',
  avatar_media_id: null,
  city_id: null,
};
let container: HTMLElement;
let root: ReturnType<typeof createRoot>;
const close = vi.fn();
async function mount() {
  await act(async () => {
    root.render(
      createElement(ProfileEditor, { session: getAuthSession()!, initial, onClose: close }),
    );
  });
}
async function click(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (node) => node.textContent === label,
  );
  expect(button).toBeDefined();
  await act(async () => {
    button!.click();
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  clearAuthToken();
  saveAuthSession('profile-editor-owner', 1);
  queryClient.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
    queryClient.clear();
  });
  container.remove();
});

describe('profile editor page save lifecycle', () => {
  it('retries navigation after a successful save without issuing another PATCH', async () => {
    gateway.patchProfile.mockResolvedValue({ ...initial, version: 2 });
    close.mockRejectedValueOnce(new Error('navigation failed')).mockResolvedValueOnce(undefined);
    await mount();
    await click('保存资料');
    expect(gateway.patchProfile).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('资料已保存');
    expect(container.querySelector('input')!.disabled).toBe(true);
    await click('完成');
    expect(close).toHaveBeenCalledTimes(2);
    expect(gateway.patchProfile).toHaveBeenCalledTimes(1);
  });

  it('ignores an old save result after the authenticated account changes', async () => {
    let resolve!: (profile: Profile) => void;
    gateway.patchProfile.mockImplementation(
      () =>
        new Promise<Profile>((done) => {
          resolve = done;
        }),
    );
    await mount();
    const oldSession = getAuthSession()!;
    await click('保存资料');
    await act(async () => {
      saveAuthSession('another-profile-owner', 2);
      resolve({ ...initial, version: 2 });
    });
    expect(close).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(sessionQueryKey(oldSession, 'profile'))).toBeUndefined();
    expect(queryClient.getQueryData(sessionQueryKey(getAuthSession(), 'profile'))).toBeUndefined();
  });

  it('preserves the draft and exposes confirmation retry after an unknown write result', async () => {
    gateway.patchProfile.mockRejectedValue(new Error('offline'));
    await mount();
    await click('保存资料');
    expect(close).not.toHaveBeenCalled();
    expect(container.querySelector('input')!.value).toBe('原昵称');
    expect(container.querySelector('input')!.disabled).toBe(true);
    expect(container.textContent).toContain('重试确认上次保存');
  });
});
