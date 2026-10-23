import { useEffect, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Text, View } from '@tarojs/components';
import { Button, Notice, StatePanel } from '../../shared/ui';
import { errorMessage } from '../../shared/api/errors';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { sessionQueryKey } from '../../shared/query/client';
import { WardrobePage } from '../../features/wardrobe/Page';
import { useWardrobeSession } from '../../features/wardrobe/session';
import { wardrobeApi } from '../../features/wardrobe/api';
import { shanghaiToday } from '../../features/wear-history/date';
import { nextShanghaiMidnight } from '../../features/weather/time';
import { GarmentCountRows, StatisticsContent } from '../../features/statistics/StatisticsContent';
import {
  recoverStatisticsCursor,
  statisticsQueryOptions,
  StatisticsCursorExpired,
} from '../../features/statistics/queries';
import styles from '../../features/statistics/statistics.module.scss';

export default function StatisticsPage() {
  const session = useWardrobeSession();
  return <StatisticsPageContent key={session?.generation ?? 'anonymous'} session={session} />;
}
function StatisticsPageContent({ session }: { session: AuthSession | null }) {
  const [day, setDay] = useState(shanghaiToday);
  const statistics = useInfiniteQuery(statisticsQueryOptions(session, day));
  useEffect(() => {
    const timer = setTimeout(
      () => setDay(shanghaiToday()),
      Math.max(1, nextShanghaiMidnight(day) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [day]);
  const options = useQuery({
    queryKey: sessionQueryKey(session, 'wardrobe-options'),
    queryFn: ({ signal }) => wardrobeApi.options(signal),
    enabled: Boolean(session),
  });
  const [resetNotice, setResetNotice] = useState(false);
  const expired = statistics.error instanceof StatisticsCursorExpired;
  useEffect(() => {
    if (session && getAuthSession() === session && expired) {
      setResetNotice(true);
      void recoverStatisticsCursor(session, statistics.error, day).catch(() => undefined);
    }
  }, [day, expired, statistics.error, session]);
  useDidShow(() => {
    const today = shanghaiToday();
    setDay(today);
    // 跨日由新 query 从第一页读取，避免 refetch 旧日期的分页链。
    if (today === day && session && getAuthSession() === session) void statistics.refetch();
  });
  const value = statistics.data?.pages[0];
  const items = statistics.data?.pages.flatMap((page) => page.garment_counts.items) ?? [];
  return (
    <WardrobePage
      title="衣柜统计"
      onReachBottom={() => {
        if (statistics.hasNextPage && !statistics.isFetching) void statistics.fetchNextPage();
      }}
    >
      <View className={styles.body}>
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
        ) : expired ? (
          <StatePanel state="loading" title="统计已变化，正在重新载入第一页" />
        ) : statistics.isPending ? (
          <StatePanel state="loading" title="正在读取衣柜统计" />
        ) : statistics.isError && !value ? (
          <StatePanel
            state="error"
            title="统计加载失败"
            detail={errorMessage(statistics.error)}
            onRetry={() => {
              void statistics.refetch();
            }}
          />
        ) : value ? (
          <>
            {resetNotice ? <Notice>统计数据已变化，分页已重置。</Notice> : null}
            <StatisticsContent value={value} categories={options.data?.categories ?? []} />
            {options.isError ? (
              <Notice tone="error">
                类别名称读取失败，暂按类别标识显示。
                <Button
                  variant="secondary"
                  onClick={() => {
                    void options.refetch();
                  }}
                >
                  重试类别名称
                </Button>
              </Notice>
            ) : null}
            <Text className={styles.heading}>衣物的已记录穿着</Text>
            {items.length ? (
              <GarmentCountRows
                items={items}
                onOpen={(id) => {
                  void Taro.navigateTo({ url: '/pages/garment-detail/index?id=' + id });
                }}
              />
            ) : (
              <StatePanel
                state="empty"
                title="暂无衣物统计"
                detail="添加衣物后可查看每件衣物的已记录穿着次数。"
              />
            )}
            {statistics.isError ? (
              <Notice tone="error">
                {errorMessage(statistics.error)}
                <Button
                  variant="secondary"
                  onClick={() => {
                    void (statistics.isFetchNextPageError
                      ? statistics.fetchNextPage()
                      : statistics.refetch());
                  }}
                >
                  重试统计
                </Button>
              </Notice>
            ) : null}
            {statistics.hasNextPage ? (
              <Button
                variant="secondary"
                loading={statistics.isFetchingNextPage}
                disabled={statistics.isFetching && !statistics.isFetchingNextPage}
                onClick={() => {
                  void statistics.fetchNextPage();
                }}
              >
                加载更多衣物
              </Button>
            ) : null}
            <Text className={styles.caption}>统计仅反映已记录的穿着，归档不会抹去既有历史。</Text>
          </>
        ) : null}
      </View>
    </WardrobePage>
  );
}
