import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Button as NativeButton, Text, View } from '@tarojs/components';
import { Button, Notice, StatePanel } from '../../shared/ui';
import { errorMessage } from '../../shared/api/errors';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { sessionQueryKey } from '../../shared/query/client';
import { Chips, Sheet, type Choice } from '../wardrobe/controls';
import { PrivatePhoto } from '../wardrobe/PrivatePhoto';
import { toggleSelection } from '../wardrobe/draft';
import { wardrobeApi, type GarmentList } from '../wardrobe/api';
import { garmentListQueryOptions } from '../wardrobe/queries';
import styles from './wear-history.module.scss';

interface PickerProps {
  session: AuthSession;
  initialIds: readonly string[];
  onApply: (ids: string[]) => void;
  onCancel: () => void;
}
export function GarmentPicker(props: PickerProps) {
  return <GarmentPickerContent key={props.session.generation} {...props} />;
}
function GarmentPickerContent({ session, initialIds, onApply, onCancel }: PickerProps) {
  const [selectedIds, setSelectedIds] = useState(() => [...new Set(initialIds)]);
  const [category, setCategory] = useState('');
  const options = useQuery({
    queryKey: sessionQueryKey(session, 'wardrobe-options'),
    queryFn: ({ signal }) => wardrobeApi.options(signal),
  });
  // 过去穿着允许选择本人任意状态，不能继承衣柜默认的可穿筛选。
  const garments = useInfiniteQuery(
    garmentListQueryOptions(session, { category: category || undefined }),
  );
  const items = garments.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <GarmentSelectionView
      items={items}
      selectedIds={selectedIds}
      categories={options.data?.categories ?? []}
      category={category}
      onCategory={setCategory}
      pending={garments.isPending}
      error={garments.isError ? errorMessage(garments.error) : null}
      directoryError={options.isError ? errorMessage(options.error) : null}
      onRetryDirectory={() => {
        void options.refetch();
      }}
      onRetry={() => {
        void garments.refetch();
      }}
      hasNext={Boolean(garments.hasNextPage)}
      loadingMore={garments.isFetchingNextPage}
      onMore={() => {
        void garments.fetchNextPage();
      }}
      onToggle={(id) => setSelectedIds((current) => toggleSelection(current, id))}
      onApply={(ids) => {
        if (getAuthSession() === session) onApply(ids);
      }}
      onCancel={onCancel}
    />
  );
}

export function GarmentSelectionView({
  items,
  selectedIds,
  categories,
  category,
  onCategory,
  pending,
  error,
  directoryError,
  onRetryDirectory,
  onRetry,
  hasNext,
  loadingMore,
  onMore,
  onToggle,
  onApply,
  onCancel,
}: {
  items: readonly GarmentList['items'][number][];
  selectedIds: readonly string[];
  categories: readonly Choice[];
  category: string;
  onCategory: (id: string) => void;
  pending: boolean;
  error: string | null;
  directoryError: string | null;
  onRetryDirectory: () => void;
  onRetry: () => void;
  hasNext: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onToggle: (id: string) => void;
  onApply: (ids: string[]) => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      title="选择穿着衣物"
      onClose={onCancel}
      footer={
        <View className={styles.stack}>
          {' '}
          <Button
            disabled={!selectedIds.length || selectedIds.length > 1000}
            onClick={() => onApply([...new Set(selectedIds)])}
          >
            完成选择（{selectedIds.length}）
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
        </View>
      }
    >
      <View className={styles.stack}>
        <Text className={styles.caption}>已选 {selectedIds.length} 件 · 选择你实际穿过的衣物</Text>
        <Chips
          options={[{ id: '', label: '全部' }, ...categories]}
          values={[category]}
          onChange={onCategory}
        />
        {directoryError ? (
          <Notice tone="error">
            分类加载失败，可继续选择衣物。
            <Button variant="secondary" onClick={onRetryDirectory}>
              重试分类
            </Button>
          </Notice>
        ) : null}
        {pending ? <StatePanel state="loading" title="正在读取衣物" /> : null}
        {error ? (
          <Notice tone="error">
            {error}
            <Button variant="secondary" onClick={onRetry}>
              重试衣物
            </Button>
          </Notice>
        ) : null}
        {!pending && !error && !items.length ? (
          <>
            <StatePanel
              state="empty"
              title={category ? '这个类别还没有衣物' : '衣柜还是空的'}
              detail={category ? '换个类别继续选择。' : '请先返回衣柜添加衣物，再记录实际穿着。'}
            />
            {category ? (
              <Button variant="secondary" onClick={() => onCategory('')}>
                查看全部衣物
              </Button>
            ) : null}
          </>
        ) : null}
        <View className={styles.selectionGrid}>
          {items.map((garment) => (
            <NativeButton
              key={garment.id}
              className={`${styles.tile} ${selectedIds.includes(garment.id) ? styles.selected : ''}`}
              onClick={() => onToggle(garment.id)}
            >
              <View className={styles.selectionPhoto}>
                <PrivatePhoto mediaId={garment.photo_media_id ?? null} />
              </View>
              <Text className={styles.itemName}>
                {selectedIds.includes(garment.id) ? '✓ ' : ''}
                {garment.name || '未命名衣物'}
              </Text>
            </NativeButton>
          ))}
        </View>
        {hasNext ? (
          <Button variant="secondary" loading={loadingMore} onClick={onMore}>
            加载更多衣物
          </Button>
        ) : null}
        {selectedIds.length > 1000 ? (
          <Notice tone="error">每条记录最多选择 1000 件衣物</Notice>
        ) : null}
      </View>
    </Sheet>
  );
}
