import { useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Button as NativeButton, Image, Text, View } from '@tarojs/components';
import { Button, Notice, StatePanel } from '../../shared/ui';
import { type AuthSession } from '../../shared/api/auth-token';
import { errorMessage } from '../../shared/api/errors';
import { sessionQueryKey } from '../../shared/query/client';
import { useTheme } from '../../shared/theme/preferences';
import { WardrobePage, openWardrobe } from '../../features/wardrobe/Page';
import { WardrobeEmptyState } from '../../features/wardrobe/EmptyState';
import { useWardrobeSession } from '../../features/wardrobe/session';
import { wardrobeApi } from '../../features/wardrobe/api';
import { garmentListQueryOptions } from '../../features/wardrobe/queries';
import { GarmentGrid } from '../../features/wardrobe/GarmentGrid';
import { RecordCard } from '../../features/wear-history/RecordCard';
import { wearListQueryOptions } from '../../features/wear-history/queries';
import { Avatar } from '../../features/profile/Avatar';
import { profileQueryOptions } from '../../features/profile/queries';
import styles from '../../features/profile/profile.module.scss';
import { useStatisticsSummary } from '../../features/statistics/useStatisticsSummary';

export default function PersonalPage() {
  const session = useWardrobeSession();
  return <PersonalContent key={session?.generation ?? 'anonymous'} session={session} />;
}
function PersonalContent({ session }: { session: AuthSession | null }) {
  const theme = useTheme();
  const [tab, setTab] = useState<'garments' | 'records'>('garments');
  const profile = useQuery(profileQueryOptions(session));
  const summary = useStatisticsSummary(session);
  const options = useQuery({
    queryKey: sessionQueryKey(session, 'wardrobe-options'),
    queryFn: ({ signal }) => wardrobeApi.options(signal),
    enabled: Boolean(session && tab === 'garments'),
  });
  const garments = useInfiniteQuery({
    ...garmentListQueryOptions(session, {}),
    enabled: Boolean(session && tab === 'garments'),
  });
  const records = useInfiniteQuery({
    ...wearListQueryOptions(session, {}),
    enabled: Boolean(session && tab === 'records'),
  });
  useDidShow(() => {
    if (session) {
      void profile.refetch();
      if (tab === 'garments') void garments.refetch();
      else void records.refetch();
    }
  });
  const items = garments.data?.pages.flatMap((page) => page.items) ?? [];
  const history = records.data?.pages.flatMap((page) => page.items) ?? [];
  const emptyTab =
    tab === 'garments' ? garments.isSuccess && !items.length : records.isSuccess && !history.length;
  const add = () => {
    void Taro.navigateTo({
      url: !session
        ? '/pages/login/index'
        : tab === 'garments'
          ? '/pages/garment-form/index'
          : '/pages/wear-form/index',
    });
  };
  return (
    <WardrobePage title="我的" tone="profile">
      <View className={styles.hero}>
        <NativeButton
          className={styles.identity}
          disabled={!session || !profile.data}
          onClick={() => {
            void Taro.navigateTo({ url: '/pages/profile-edit/index' });
          }}
        >
          <Avatar mediaId={profile.data?.avatar_media_id ?? null} large />
          <View className={styles.identityCopy}>
            <Text className={styles.nicknameTitle}>{profile.data?.nickname || '衣柜用户'}</Text>
            <Text className={styles.caption}>
              {profile.isPending && session ? '正在读取个人资料' : '编辑个人资料  ›'}
            </Text>
          </View>
        </NativeButton>
        <NativeButton
          className={styles.settingsEntry}
          onClick={() => {
            void Taro.navigateTo({ url: '/pages/business-settings/index' });
          }}
        >
          <Image className={styles.icon} src={`/assets/library-icons/settings-${theme}-text.png`} />
          <Text className={styles.small}>设置</Text>
        </NativeButton>
      </View>
      {profile.isError ? (
        <View className={styles.content}>
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
        </View>
      ) : null}
      {!session ? (
        <View className={styles.body}>
          <StatePanel
            state="empty"
            title="请先微信登录"
            detail="登录后查看自己的衣物和实际穿着。"
          />
          <Button onClick={add}>微信登录</Button>
        </View>
      ) : (
        <>
          <View className={styles.tabs}>
            <NativeButton
              className={`${styles.tab} ${tab === 'garments' ? styles.tabActive : ''}`}
              onClick={() => setTab('garments')}
            >
              衣物{summary ? ` ${summary.wardrobe_total + summary.archived_count}` : ''}
            </NativeButton>
            <NativeButton
              className={`${styles.tab} ${tab === 'records' ? styles.tabActive : ''}`}
              onClick={() => setTab('records')}
            >
              穿着记录{summary ? ` ${summary.wear_record_count}` : ''}
            </NativeButton>
            {!emptyTab ? (
              <View className={styles.addAction}>
                <Button variant="secondary" onClick={add}>
                  {tab === 'garments' ? '＋ 添加' : '＋ 记录'}
                </Button>
              </View>
            ) : null}
          </View>
          <View className={styles.content}>
            {tab === 'garments' ? (
              <>
                {garments.isPending ? (
                  <StatePanel state="loading" title="正在读取衣物" />
                ) : garments.isError && !items.length ? (
                  <StatePanel
                    state="error"
                    title="衣物读取失败"
                    detail={errorMessage(garments.error)}
                    onRetry={() => {
                      void garments.refetch();
                    }}
                  />
                ) : !items.length ? (
                  <WardrobeEmptyState kind="wardrobe" presentation="profile" onAction={add} />
                ) : (
                  <>
                    <View className={styles.clothing}>
                      <GarmentGrid
                        items={items}
                        categories={options.data?.categories ?? []}
                        colors={options.data?.colors ?? []}
                        onOpen={(id) => {
                          void Taro.navigateTo({ url: '/pages/garment-detail/index?id=' + id });
                        }}
                      />
                    </View>
                    {garments.isError ? (
                      <Notice tone="error">{errorMessage(garments.error)}</Notice>
                    ) : null}
                    {garments.hasNextPage ? (
                      <Button
                        variant="secondary"
                        loading={garments.isFetchingNextPage}
                        onClick={() => {
                          void garments.fetchNextPage();
                        }}
                      >
                        加载更多衣物
                      </Button>
                    ) : null}
                  </>
                )}
                {!emptyTab ? (
                  <View className={styles.management}>
                    <Text className={styles.caption}>分类、状态与全部衣物</Text>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void openWardrobe();
                      }}
                    >
                      管理衣柜
                    </Button>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                {records.isPending ? (
                  <StatePanel state="loading" title="正在读取穿着记录" />
                ) : records.isError && !history.length ? (
                  <StatePanel
                    state="error"
                    title="记录读取失败"
                    detail={errorMessage(records.error)}
                    onRetry={() => {
                      void records.refetch();
                    }}
                  />
                ) : !history.length ? (
                  <WardrobeEmptyState kind="records" presentation="profile" onAction={add} />
                ) : (
                  <>
                    {history.map((record) => (
                      <RecordCard
                        key={record.id}
                        record={record}
                        onOpen={() => {
                          void Taro.navigateTo({ url: '/pages/wear-detail/index?id=' + record.id });
                        }}
                      />
                    ))}
                    {records.isError ? (
                      <Notice tone="error">{errorMessage(records.error)}</Notice>
                    ) : null}
                    {records.hasNextPage ? (
                      <Button
                        variant="secondary"
                        loading={records.isFetchingNextPage}
                        onClick={() => {
                          void records.fetchNextPage();
                        }}
                      >
                        加载更多记录
                      </Button>
                    ) : null}
                  </>
                )}
              </>
            )}
            <Text className={styles.privacy}>只属于你的衣柜，内容仅自己可见</Text>
          </View>
        </>
      )}
    </WardrobePage>
  );
}
