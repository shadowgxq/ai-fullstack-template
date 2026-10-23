import Taro from '@tarojs/taro';
import { useQuery } from '@tanstack/react-query';
import { StatePanel } from '../../shared/ui';
import { errorMessage } from '../../shared/api/errors';
import { getAuthSession } from '../../shared/api/auth-token';
import { WardrobePage } from '../../features/wardrobe/Page';
import { useWardrobeSession } from '../../features/wardrobe/session';
import { profileQueryOptions } from '../../features/profile/queries';
import { ProfileEditor } from '../../features/profile/ProfileEditor';

export default function ProfileEditPage() {
  const session = useWardrobeSession();
  const profile = useQuery(profileQueryOptions(session));
  if (session && profile.data)
    return (
      <ProfileEditor
        key={session.generation}
        session={session}
        initial={profile.data}
        onClose={() => {
          if (getAuthSession() !== session) return Promise.resolve();
          return Taro.navigateBack().catch(() => {
            if (getAuthSession() !== session) return;
            return Taro.redirectTo({ url: '/pages/personal/index' });
          });
        }}
      />
    );
  return (
    <WardrobePage title="编辑个人资料" tone="settings">
      <StatePanel
        state={profile.isError ? 'error' : 'loading'}
        title={profile.isError ? '个人资料读取失败' : '正在读取个人资料'}
        detail={profile.isError ? errorMessage(profile.error) : undefined}
        onRetry={() => {
          void profile.refetch();
        }}
      />
    </WardrobePage>
  );
}
