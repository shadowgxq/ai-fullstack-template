import { useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import { useQuery } from '@tanstack/react-query';
import { Button as NativeButton, Image, Text, View } from '@tarojs/components';
import { Button, Notice, StatePanel } from '../../shared/ui';
import {
  getAuthSession,
  getSessionGeneration,
  type AuthSession,
} from '../../shared/api/auth-token';
import { errorMessage } from '../../shared/api/errors';
import { useTheme } from '../../shared/theme/preferences';
import { WardrobePage } from '../../features/wardrobe/Page';
import { ConfirmDialog } from '../../features/wardrobe/ConfirmDialog';
import { useWardrobeSession } from '../../features/wardrobe/session';
import { Avatar } from '../../features/profile/Avatar';
import { WardrobeIcon } from '../../features/wardrobe/Icon';
import { profileQueryOptions } from '../../features/profile/queries';
import { CityWeatherSettings } from '../../features/weather/CityWeatherSettings';
import { logoutProfileSession } from '../../features/profile/logout';
import { redirectToLogin } from '../../features/auth/navigation';
import styles from '../../features/profile/profile.module.scss';

export default function BusinessSettingsPage() {
  const session = useWardrobeSession();
  const logout = async (captured: AuthSession) => {
    const result = await logoutProfileSession(captured);
    if (!result) return;
    await redirectToLogin();
    if (result.warning && getAuthSession() === null && getSessionGeneration() === result.generation)
      void Taro.showToast({ title: result.warning, icon: 'none' });
  };
  return (
    <WardrobePage title="设置" tone="settings">
      <SettingsContent
        key={session?.generation ?? 'anonymous'}
        session={session}
        onLogout={logout}
      />
    </WardrobePage>
  );
}
function SettingsContent({
  session,
  onLogout,
}: {
  session: AuthSession | null;
  onLogout: (session: AuthSession) => Promise<void>;
}) {
  const theme = useTheme();
  const profile = useQuery(profileQueryOptions(session));
  const [confirm, setConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const lock = useRef(false);
  return (
    <View className={styles.settingsBody}>
      {!session ? (
        <>
          <StatePanel state="empty" title="请先微信登录" />
          <Button
            onClick={() => {
              void Taro.navigateTo({ url: '/pages/login/index' });
            }}
          >
            微信登录
          </Button>
        </>
      ) : (
        <>
          <NativeButton
            className={styles.profileCard}
            disabled={!profile.data}
            onClick={() => {
              void Taro.navigateTo({ url: '/pages/profile-edit/index' });
            }}
          >
            <Avatar mediaId={profile.data?.avatar_media_id ?? null} large />
            <View className={styles.identityCopy}>
              <Text className={styles.cardNickname}>{profile.data?.nickname || '衣柜用户'}</Text>
              <Text className={styles.caption}>编辑个人资料</Text>
            </View>
            <Text className={styles.caption}>›</Text>
          </NativeButton>
          <View className={styles.settingsGroup}>
            <Text className={styles.caption}>账户</Text>
            <NativeButton
              className={styles.settingsRow}
              disabled={!profile.data}
              onClick={() => {
                void Taro.navigateTo({ url: '/pages/profile-edit/index' });
              }}
            >
              <Image
                className={styles.icon}
                src={`/assets/library-icons/profile-${theme}-text.png`}
              />
              <Text className={styles.settingsName}>个人资料</Text>
              <Text className={styles.caption}>头像与昵称 ›</Text>
            </NativeButton>
          </View>
          <View className={styles.settingsGroup}>
            <Text className={styles.caption}>穿搭设置</Text>
            <View className={styles.settingsRows}>
              <NativeButton
                className={styles.settingsRow}
                onClick={() => {
                  void Taro.navigateTo({ url: '/pages/wardrobe-preferences/index' });
                }}
              >
                <WardrobeIcon name="sliders-horizontal" />
                <Text className={styles.settingsName}>穿搭偏好</Text>
                <Text className={styles.caption}>按喜好推荐 ›</Text>
              </NativeButton>
              {profile.data ? (
                <CityWeatherSettings session={session} profile={profile.data} />
              ) : null}
            </View>
          </View>
          {profile.isPending ? (
            <Notice>正在读取个人资料</Notice>
          ) : profile.isError ? (
            <Notice tone="error">
              {errorMessage(profile.error)}
              <Button
                variant="secondary"
                onClick={() => {
                  void profile.refetch();
                }}
              >
                重试个人资料
              </Button>
            </Notice>
          ) : null}
          <NativeButton
            className={styles.logoutAction}
            disabled={loggingOut}
            onClick={() => setConfirm(true)}
          >
            退出登录
          </NativeButton>
        </>
      )}
      <View className={styles.privacyNote}>
        <WardrobeIcon name="shield-check" tone="muted" />
        <Text className={styles.privacy}>衣物、偏好与穿着记录仅自己可见</Text>
      </View>
      {confirm && session ? (
        <ConfirmDialog
          title="退出登录"
          detail="仅退出当前登录，不会删除衣物或穿着历史。"
          confirmLabel="确认退出"
          busy={loggingOut}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            if (lock.current || getAuthSession() !== session) return;
            lock.current = true;
            setLoggingOut(true);
            void onLogout(session).finally(() => {
              lock.current = false;
              if (getAuthSession() === session) {
                setLoggingOut(false);
                setConfirm(false);
              }
            });
          }}
        />
      ) : null}
    </View>
  );
}
