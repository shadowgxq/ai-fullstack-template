import { useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { Button as NativeButton, Text, View } from '@tarojs/components';
import { Button, Notice, StatePanel } from '../../shared/ui';
import { errorMessage } from '../../shared/api/errors';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { WardrobePage } from '../../features/wardrobe/Page';
import { WardrobeEmptyState } from '../../features/wardrobe/EmptyState';
import { useWardrobeSession } from '../../features/wardrobe/session';
import { Sheet } from '../../features/wardrobe/controls';
import { WardrobeNavigation } from '../../features/wear-history/Navigation';
import { ConfirmDialog } from '../../features/wardrobe/ConfirmDialog';
import { DateRangeFields } from '../../features/wear-history/WearForm';
import { RecordCard } from '../../features/wear-history/RecordCard';
import { wearApi, type WearFilters, type WearRecord } from '../../features/wear-history/api';
import { invalidateWearFacts, wearListQueryOptions } from '../../features/wear-history/queries';
import { validateDateRange } from '../../features/wear-history/date';
import styles from '../../features/wear-history/wear-history.module.scss';
import { useStatisticsSummary } from '../../features/statistics/useStatisticsSummary';

export default function WearHistoryPage() {
  const session = useWardrobeSession();
  return <HistoryContent key={session?.generation ?? 'anonymous'} session={session} />;
}
function HistoryContent({ session }: { session: AuthSession | null }) {
  const [filters, setFilters] = useState<WearFilters>({});
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [menu, setMenu] = useState<WearRecord | null>(null);
  const [deleting, setDeleting] = useState<WearRecord | null>(null);
  const list = useInfiniteQuery(wearListQueryOptions(session, filters));
  const summary = useStatisticsSummary(session);
  useDidShow(() => {
    if (session) void list.refetch();
  });
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const deletion = useMutation({
    mutationFn: (record: WearRecord) => wearApi.remove(record.id, record.version),
    onSuccess: async () => {
      if (!session || getAuthSession() !== session) return;
      setDeleting(null);
      await invalidateWearFacts(session);
    },
  });
  const add = () => {
    void Taro.navigateTo({ url: session ? '/pages/wear-form/index' : '/pages/login/index' });
  };
  const hasFilters = Boolean(filters.start_date || filters.end_date);
  const emptyHistory = list.isSuccess && !hasFilters && !items.length;
  return (
    <WardrobePage
      title="穿着记录"
      account
      footer={session && !emptyHistory ? <Button onClick={add}>补录穿着</Button> : undefined}
      bottomNavigation={<WardrobeNavigation active="records" />}
      onReachBottom={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
      }}
    >
      {emptyHistory ? (
        <WardrobeEmptyState
          kind="records"
          onAction={add}
          secondaryAction={{
            label: '衣柜统计',
            onClick: () => {
              void Taro.navigateTo({ url: '/pages/statistics/index' });
            },
          }}
        />
      ) : (
        <View className={styles.body}>
          {!session ? (
            <>
              <StatePanel
                state="empty"
                title="请先微信登录"
                detail="登录后查看和记录自己的实际穿着。"
              />
              <Button onClick={add}>微信登录</Button>
            </>
          ) : (
            <>
              <View className={styles.row}>
                <Text className={styles.caption}>
                  {summary
                    ? `近 30 天已记录 ${summary.trend.days.reduce((sum, day) => sum + day.count, 0)} 套`
                    : `已显示 ${items.length} 条记录`}
                </Text>
                <View className={styles.statisticsLink}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void Taro.navigateTo({ url: '/pages/statistics/index' });
                    }}
                  >
                    衣柜统计
                  </Button>
                </View>
              </View>
              <NativeButton
                className={styles.rangeAction}
                onClick={() => {
                  setRange({ start: filters.start_date ?? '', end: filters.end_date ?? '' });
                  setRangeError(null);
                }}
              >
                日期范围{hasFilters ? ' · 已筛选' : ''}
              </NativeButton>
              <Text className={styles.heading}>只记录实际穿过的搭配</Text>
              {list.isPending ? (
                <StatePanel state="loading" title="正在读取穿着记录" />
              ) : list.isError && !items.length ? (
                <StatePanel
                  state="error"
                  title="记录加载失败"
                  detail={errorMessage(list.error)}
                  onRetry={() => {
                    void list.refetch();
                  }}
                />
              ) : !items.length ? (
                <WardrobeEmptyState
                  kind="records"
                  presentation="inline"
                  title="这个日期范围没有记录"
                  detail="调整日期范围，或补录过去的穿着。"
                  actionLabel="清除日期筛选"
                  actionIcon={null}
                  onAction={() => setFilters({})}
                />
              ) : (
                <>
                  {items.map((record) => (
                    <RecordCard
                      key={record.id}
                      record={record}
                      onOpen={() => {
                        void Taro.navigateTo({ url: '/pages/wear-detail/index?id=' + record.id });
                      }}
                      onMenu={() => {
                        setMenu((current) => (current?.id === record.id ? null : record));
                        deletion.reset();
                      }}
                      menu={
                        menu?.id === record.id ? (
                          <View className={styles.recordMenu}>
                            <NativeButton
                              className={styles.recordMenuItem}
                              onClick={() => {
                                void Taro.navigateTo({
                                  url: '/pages/wear-form/index?id=' + record.id,
                                });
                                setMenu(null);
                              }}
                            >
                              修改记录
                            </NativeButton>
                            <NativeButton
                              className={`${styles.recordMenuItem} ${styles.recordMenuDanger}`}
                              onClick={() => {
                                setDeleting(record);
                                setMenu(null);
                              }}
                            >
                              删除记录
                            </NativeButton>
                          </View>
                        ) : undefined
                      }
                    />
                  ))}
                  {list.isError ? <Notice tone="error">{errorMessage(list.error)}</Notice> : null}
                  {list.hasNextPage ? (
                    <Button
                      variant="secondary"
                      loading={list.isFetchingNextPage}
                      onClick={() => {
                        void list.fetchNextPage();
                      }}
                    >
                      加载更多记录
                    </Button>
                  ) : null}
                </>
              )}
              <Text className={styles.caption}>未记录的日期不代表没有穿过。</Text>
            </>
          )}
        </View>
      )}
      {range ? (
        <Sheet title="筛选穿着日期" onClose={() => setRange(null)}>
          <View className={styles.stack}>
            <DateRangeFields
              start={range.start}
              end={range.end}
              onStart={(start) => setRange({ ...range, start })}
              onEnd={(end) => setRange({ ...range, end })}
            />
            {rangeError ? <Notice tone="error">{rangeError}</Notice> : null}
            <Button
              onClick={() => {
                const error = validateDateRange(range.start, range.end);
                setRangeError(error);
                if (!error) {
                  setFilters({
                    start_date: range.start || undefined,
                    end_date: range.end || undefined,
                  });
                  setRange(null);
                }
              }}
            >
              应用筛选
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setFilters({});
                setRange(null);
              }}
            >
              清除筛选
            </Button>
            <Button variant="secondary" onClick={() => setRange(null)}>
              取消
            </Button>
          </View>
        </Sheet>
      ) : null}
      {menu ? (
        <View className={styles.menuBackdrop} catchMove onClick={() => setMenu(null)} />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title="删除穿着记录"
          detail="删除后，这条穿着记录及其对应计数将移除，衣柜中的衣物仍会保留。"
          confirmLabel="删除记录"
          danger
          busy={deletion.isPending}
          error={deletion.isError ? errorMessage(deletion.error) : null}
          onConfirm={() => deletion.mutate(deleting)}
          onCancel={() => {
            setDeleting(null);
            deletion.reset();
          }}
        />
      ) : null}
    </WardrobePage>
  );
}
