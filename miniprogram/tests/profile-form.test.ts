import { Children, isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/components', () => ({
  Button: 'button',
  Input: 'input',
  Label: 'label',
  Text: 'text',
  View: 'view',
}));
vi.mock('../src/shared/ui', () => ({ Button: 'button', Notice: 'notice' }));
vi.mock('../src/features/profile/Avatar', () => ({ Avatar: 'avatar' }));
import { ProfileForm } from '../src/features/profile/ProfileForm';

type NodeProps = { children?: ReactNode; [key: string]: unknown };
function nodes(node: ReactNode, type: string): NodeProps[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<NodeProps>(child)) return [];
    return [...(child.type === type ? [child.props] : []), ...nodes(child.props.children, type)];
  });
}
function form(disabled = false, uploading = false) {
  const callbacks = {
    onNickname: vi.fn(),
    onAvatar: vi.fn(),
    onAvatarError: vi.fn(),
    onRemove: vi.fn(),
    onRetry: vi.fn(),
    onReview: vi.fn(),
    onSave: vi.fn(),
  };
  const tree = ProfileForm({
    draft: { nickname: '旧昵称', avatarMediaId: null },
    disabled,
    uploading,
    preview: null,
    error: null,
    uploadError: null,
    nicknameError: null,
    ...callbacks,
  });
  const avatar = nodes(tree, 'button').find((node) => node.openType === 'chooseAvatar')!;
  const input = nodes(tree, 'input')[0];
  return { ...callbacks, avatar, input };
}
function emit(node: NodeProps, event: string, detail: unknown) {
  (node[event] as (value: { detail: unknown }) => void)({ detail });
}

describe('native profile form interactions', () => {
  it('uses the native avatar event, preserves cancellation and accepts only a real temporary path', () => {
    const view = form();
    expect(view.avatar.openType).toBe('chooseAvatar');
    emit(view.avatar, 'onChooseAvatar', {});
    emit(view.avatar, 'onChooseAvatar', { avatarUrl: '  ' });
    emit(view.avatar, 'onError', { errMsg: 'chooseAvatar:fail cancel' });
    expect(view.onAvatar).not.toHaveBeenCalled();
    expect(view.onAvatarError).not.toHaveBeenCalled();
    emit(view.avatar, 'onChooseAvatar', { avatarUrl: 'wxfile://selected-avatar' });
    expect(view.onAvatar).toHaveBeenCalledExactlyOnceWith('wxfile://selected-avatar');
    emit(view.avatar, 'onError', { errMsg: 'chooseAvatar:fail permission denied' });
    expect(view.onAvatarError).toHaveBeenCalledOnce();
  });
  it('forwards native nickname input and the actual review result', () => {
    const view = form();
    expect(view.input.type).toBe('nickname');
    expect(view.input.value).toBe('旧昵称');
    emit(view.input, 'onInput', { value: '新昵称' });
    emit(view.input, 'onNickNameReview', { pass: false });
    emit(view.input, 'onNickNameReview', { timeout: true });
    expect(view.onNickname).toHaveBeenCalledExactlyOnceWith('新昵称');
    expect(view.onReview).toHaveBeenCalledExactlyOnceWith(false);
  });
  it('ignores native late events while the form is locked and avatar selection during upload', () => {
    const locked = form(true);
    expect(locked.avatar.disabled).toBe(true);
    expect(locked.input.disabled).toBe(true);
    emit(locked.avatar, 'onChooseAvatar', { avatarUrl: 'wxfile://late' });
    emit(locked.avatar, 'onError', { errMsg: 'failed' });
    emit(locked.input, 'onInput', { value: 'late' });
    emit(locked.input, 'onNickNameReview', { pass: true });
    for (const callback of [
      locked.onAvatar,
      locked.onAvatarError,
      locked.onNickname,
      locked.onReview,
    ])
      expect(callback).not.toHaveBeenCalled();
    const uploading = form(false, true);
    emit(uploading.avatar, 'onChooseAvatar', { avatarUrl: 'wxfile://second' });
    expect(uploading.onAvatar).not.toHaveBeenCalled();
  });
});
