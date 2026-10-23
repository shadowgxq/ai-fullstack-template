import { useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Button as NativeButton, Text, View } from '@tarojs/components';
import { Button, Field, Notice, StatePanel } from '../../shared/ui';
import { errorMessage } from '../../shared/api/errors';
import type { AuthSession } from '../../shared/api/auth-token';
import { sessionQueryKey } from '../../shared/query/client';
import { WardrobePage } from '../../features/wardrobe/Page';
import { WardrobeEmptyState } from '../../features/wardrobe/EmptyState';
import { useWardrobeSession } from '../../features/wardrobe/session';
import { Chips, Sheet } from '../../features/wardrobe/controls';
import { GarmentGrid } from '../../features/wardrobe/GarmentGrid';
import { wardrobeApi, type GarmentFilters } from '../../features/wardrobe/api';
import { garmentListQueryOptions } from '../../features/wardrobe/queries';
import styles from '../../features/wardrobe/wardrobe.module.scss';
import { WardrobeNavigation } from '../../features/wear-history/Navigation';
import { useStatisticsSummary } from '../../features/statistics/useStatisticsSummary';

export default function WardrobeListPage() {
  const session = useWardrobeSession();
  return <WardrobeListContent key={session?.generation ?? 'anonymous'} session={session} />;
}
function WardrobeListContent({ session }: { session: AuthSession | null }) {
  const [filters, setFilters] = useState<GarmentFilters>({ status: 'wearable' });
  const [filterDraft, setFilterDraft] = useState<GarmentFilters | null>(null);
  const options = useQuery({
    queryKey: sessionQueryKey(session, 'wardrobe-options'),
    queryFn: ({ signal }) => wardrobeApi.options(signal),
    enabled: Boolean(session),
  });
  const list = useInfiniteQuery(garmentListQueryOptions(session, filters));
  const summary = useStatisticsSummary(session);
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const hasFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== null && value !== '',
  );
  // 默认筛选只展示可穿衣物，必须另核对全部库存才能隐藏筛选区。
  const inventory = useInfiniteQuery({
    ...garmentListQueryOptions(session, {}),
    enabled: Boolean(session && hasFilters && list.isSuccess && !items.length),
  });
  const emptyInventory =
    list.isSuccess &&
    !items.length &&
    (!hasFilters || (inventory.isSuccess && !inventory.data.pages[0].items.length));
  useDidShow(() => {
    if (session) {
      void list.refetch();
      if (hasFilters && list.isSuccess && !items.length) void inventory.refetch();
    }
  });
  const add = () => {
    void Taro.navigateTo({ url: session ? '/pages/garment-form/index' : '/pages/login/index' });
  };
  const statusOptions = [
    {
      id: 'wearable',
      label: summary?.wearable_count != null ? `可穿 ${summary.wearable_count}` : '可穿',
    },
    {
      id: 'unavailable',
      label:
        summary?.unavailable_count != null ? `暂不可穿 ${summary.unavailable_count}` : '暂不可穿',
    },
    { id: 'archived', label: summary ? `已归档 ${summary.archived_count}` : '已归档' },
  ];
  return (
    <WardrobePage
      title="我的衣柜"
      account
      bottomNavigation={<WardrobeNavigation active="wardrobe" />}
      footer={session && !emptyInventory ? <Button onClick={add}>添加衣物</Button> : undefined}
      onReachBottom={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
      }}
    >
      {emptyInventory ? (
        <WardrobeEmptyState kind="wardrobe" onAction={add} />
      ) : (
        <View className={styles.body}>
          {!session ? (
            <>
              <StatePanel
                state="empty"
                title="开启你的专属衣柜"
                detail="微信登录后管理自己的衣物和照片。"
              />
              <Button onClick={add}>微信登录</Button>
            </>
          ) : (
            <>
              <Text className={styles.caption}>
                {summary
                  ? `${summary.wardrobe_total} 件衣物 · 已归档 ${summary.archived_count} 件`
                  : `已显示 ${items.length} 件衣物`}
              </Text>
              <Chips
                scroll
                options={statusOptions}
                values={[filters.status ?? '']}
                onChange={(value) =>
                  setFilters((previous) => ({
                    ...previous,
                    status: value ? (value as 'wearable' | 'unavailable' | 'archived') : undefined,
                  }))
                }
              />
              {options.data ? (
                <Chips
                  scroll
                  options={[{ id: '', label: '全部类别' }, ...options.data.categories]}
                  values={[filters.category ?? '']}
                  onChange={(category) =>
                    setFilters((previous) => ({ ...previous, category: category || undefined }))
                  }
                />
              ) : null}
              <View className={styles.filterHeading}>
                <Text className={styles.title}>
                  {filters.status === 'wearable'
                    ? '可穿衣物'
                    : filters.status === 'unavailable'
                      ? '暂不可穿衣物'
                      : filters.status === 'archived'
                        ? '已归档衣物'
                        : '全部衣物'}
                </Text>
                <NativeButton
                  className={styles.textAction}
                  disabled={!options.data}
                  onClick={() => setFilterDraft({ ...filters })}
                >
                  更多筛选
                </NativeButton>
              </View>
              {options.isError ? (
                <Notice tone="error">
                  选项目录加载失败，可继续浏览衣物。
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void options.refetch();
                    }}
                  >
                    重试目录
                  </Button>
                </Notice>
              ) : null}
              {list.isPending ? (
                <StatePanel state="loading" title="正在读取衣柜" />
              ) : list.isError && !items.length ? (
                <StatePanel
                  state="error"
                  title="衣柜加载失败"
                  detail={errorMessage(list.error)}
                  onRetry={() => {
                    void list.refetch();
                  }}
                />
              ) : !items.length ? (
                inventory.isPending ? (
                  <StatePanel state="loading" title="正在核对全部库存" />
                ) : inventory.isError ? (
                  <StatePanel
                    state="error"
                    title="全部库存暂时无法读取"
                    detail={errorMessage(inventory.error)}
                    onRetry={() => {
                      void inventory.refetch();
                    }}
                  />
                ) : (
                  <WardrobeEmptyState
                    kind="wardrobe"
                    presentation="inline"
                    title="没有符合条件的衣物"
                    detail="试试其他条件，或清除筛选查看衣物。"
                    actionLabel="清除筛选"
                    actionIcon={null}
                    onAction={() => setFilters({})}
                  />
                )
              ) : (
                <>
                  <GarmentGrid
                    items={items}
                    categories={options.data?.categories ?? []}
                    colors={options.data?.colors ?? []}
                    onOpen={(id) => {
                      void Taro.navigateTo({ url: '/pages/garment-detail/index?id=' + id });
                    }}
                  />
                  {list.isError ? <Notice tone="error">{errorMessage(list.error)}</Notice> : null}
                  {list.hasNextPage ? (
                    <Button
                      variant="secondary"
                      loading={list.isFetchingNextPage}
                      onClick={() => {
                        void list.fetchNextPage();
                      }}
                    >
                      加载更多
                    </Button>
                  ) : null}
                </>
              )}
            </>
          )}
        </View>
      )}
      {filterDraft && options.data ? (
        <Sheet title="筛选衣物" onClose={() => setFilterDraft(null)}>
          <View className={styles.stack}>
            {(['color', 'season', 'occasion'] as const).map((field) => (
              <View className={styles.stack} key={field}>
                <Text className={styles.label}>
                  {field === 'color' ? '主要颜色' : field === 'season' ? '适用季节' : '适用场合'}
                </Text>
                <Chips
                  options={
                    options.data[
                      field === 'color' ? 'colors' : field === 'season' ? 'seasons' : 'occasions'
                    ]
                  }
                  values={filterDraft[field] ? [filterDraft[field]!] : []}
                  onChange={(value) =>
                    setFilterDraft((previous) =>
                      previous
                        ? { ...previous, [field]: previous[field] === value ? undefined : value }
                        : null,
                    )
                  }
                />
              </View>
            ))}
            <Field
              id="filter-tag"
              label="标签"
              value={filterDraft.tag ?? ''}
              onValueChange={(tag) =>
                setFilterDraft((previous) =>
                  previous ? { ...previous, tag: tag || undefined } : null,
                )
              }
              maxLength={40}
            />
            <Button
              onClick={() => {
                setFilters(filterDraft);
                setFilterDraft(null);
              }}
            >
              应用筛选
            </Button>
            <Button variant="secondary" onClick={() => setFilterDraft(null)}>
              取消
            </Button>
          </View>
        </Sheet>
      ) : null}
    </WardrobePage>
  );
}
