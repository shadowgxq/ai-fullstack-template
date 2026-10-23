import avatarImage from '../../assets/library/avatar.jpg';
import crownImage from '../../assets/library/crown.jpg';
import { useState, useSyncExternalStore } from 'react';
import Taro from '@tarojs/taro';
import { Image, Text, View, Button as NativeButton } from '@tarojs/components';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/gateway';
import { getAuthSession, subscribeAuthToken } from '../../shared/api/auth-token';
import { logoutCurrentSession } from '../../features/auth/session';
import { errorMessage } from '../../shared/api/errors';
import { sessionQueryKey } from '../../shared/query/client';
import { PageShell, Notice } from '../../shared/ui';
import { LibraryIcon } from '../../features/component-library/visuals';
import { openCatalog, showReferenceEntry } from '../../features/component-library/navigation';
import styles from './index.module.scss';

export default function SettingsPage() {
  const session = useSyncExternalStore(subscribeAuthToken, getAuthSession, getAuthSession);
  const [logoutWarning, setLogoutWarning] = useState<string | null>(null);
  const profile = useQuery({
    queryKey: sessionQueryKey(session, 'profile'),
    queryFn: ({ signal }) => api.profile(signal),
    enabled: Boolean(session),
  });
  const logout = useMutation({
    mutationFn: logoutCurrentSession,
    onSuccess: setLogoutWarning,
  });
  const openAccount = () => {
    void Taro.navigateTo({ url: session ? '/pages/preferences/index' : '/pages/login/index' });
  };
  return (
    <PageShell tinted>
      <NativeButton className={styles.identity} onClick={openAccount}>
        <Image className={styles.avatar} src={avatarImage} mode="aspectFill" />
        <View className={styles.copy}>
          <Text className={styles.greeting}>Hi，{profile.data?.nickname || '衣柜用户'}</Text>
          <Text className={styles.subtitle}>让好的产品触手可及</Text>
        </View>
        <View className={styles.roundArrow}>
          <LibraryIcon name="arrow" />
        </View>
      </NativeButton>
      <View className={styles.stats}>
        {[
          ['12', '我的收藏'],
          ['8', '最近使用'],
          ['24', '我的组件'],
        ].map(([value, label], index) => (
          <NativeButton
            key={label}
            className={styles.stat}
            onClick={() => {
              if (index === 2) void openCatalog();
              else showReferenceEntry(label);
            }}
          >
            <Text className={styles.statValue}>{value}</Text>
            <Text className={styles.statLabel}>{label}</Text>
          </NativeButton>
        ))}
      </View>
      <View className={styles.settings}>
        <NativeButton
          className={styles.row}
          onClick={() => {
            void Taro.navigateTo({ url: '/pages/preferences/index' });
          }}
        >
          <LibraryIcon name="settings" />
          <View className={styles.copy}>
            <Text className={styles.rowTitle}>系统设置</Text>
            <Text className={styles.detail}>主题、语言、通知等</Text>
          </View>
          <LibraryIcon name="arrow" tone="muted" />
        </NativeButton>
        <NativeButton className={styles.row} onClick={() => showReferenceEntry('意见反馈')}>
          <LibraryIcon name="clipboard" />
          <View className={styles.copy}>
            <Text className={styles.rowTitle}>意见反馈</Text>
            <Text className={styles.detail}>告诉我们你的建议</Text>
          </View>
          <LibraryIcon name="arrow" tone="muted" />
        </NativeButton>
        <NativeButton
          className={styles.row}
          onClick={() => {
            void Taro.showModal({
              title: '关于我们',
              content: `移动端组件库 · 版本 ${__APP_VERSION__}`,
              showCancel: false,
            });
          }}
        >
          <LibraryIcon name="info" />
          <View className={styles.copy}>
            <Text className={styles.rowTitle}>关于我们</Text>
            <Text className={styles.detail}>产品介绍与联系方式</Text>
          </View>
          <LibraryIcon name="arrow" tone="muted" />
        </NativeButton>
        <NativeButton
          className={styles.row}
          onClick={() => {
            void Taro.showModal({
              title: '版本更新',
              content: `当前版本 ${__APP_VERSION__}，暂未接入版本检查服务。`,
              showCancel: false,
            });
          }}
        >
          <LibraryIcon name="home" />
          <View className={styles.copy}>
            <Text className={styles.rowTitle}>版本更新</Text>
            <Text className={styles.detail}>检查新版本</Text>
          </View>
          <Text className={styles.version}>v{__APP_VERSION__}</Text>
          <LibraryIcon name="arrow" tone="muted" />
        </NativeButton>
      </View>
      <NativeButton className={styles.community} onClick={() => showReferenceEntry('加入社区')}>
        <Image className={styles.crown} src={crownImage} mode="aspectFill" />
        <View className={styles.copy}>
          <Text className={styles.rowTitle}>加入社区</Text>
          <Text className={styles.detail}>获取更多组件与最佳实践</Text>
        </View>
        <View className={styles.communityArrow}>
          <LibraryIcon name="arrow" />
        </View>
      </NativeButton>
      {profile.isError ? <Notice tone="error">{errorMessage(profile.error)}</Notice> : null}
      {logout.isError ? <Notice tone="error">{errorMessage(logout.error)}</Notice> : null}
      {logoutWarning ? <Notice tone="error">{logoutWarning}</Notice> : null}
      <NativeButton
        className={styles.logout}
        loading={logout.isPending}
        disabled={logout.isPending}
        onClick={() => {
          if (session) logout.mutate();
          else openAccount();
        }}
      >
        {session ? '退出登录' : '微信登录'}
      </NativeButton>
    </PageShell>
  );
}
