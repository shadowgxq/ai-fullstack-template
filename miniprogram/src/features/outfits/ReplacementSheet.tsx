import { useInfiniteQuery } from '@tanstack/react-query';
import { Button as NativeButton, Text, View } from '@tarojs/components';
import type { AuthSession } from '../../shared/api/auth-token';
import { errorMessage } from '../../shared/api/errors';
import { sessionQueryKey } from '../../shared/query/client';
import { Button, Notice, StatePanel } from '../../shared/ui';
import type { Garment } from '../wardrobe/api';
import { Sheet } from '../wardrobe/controls';
import { PrivatePhoto } from '../wardrobe/PrivatePhoto';
import { recommendationApi } from './api';
import styles from './outfits.module.scss';

export function ReplacementChoices({
  items,
  currentId,
  onChoose,
}: {
  items: Garment[];
  currentId: string;
  onChoose: (item: Garment) => void;
}) {
  return (
    <View className={`${styles.garments} ${styles.replacementPhotos}`}>
      {items.map((item) => (
        <NativeButton
          className={`${styles.garment} ${item.id === currentId ? styles.selected : ''}`}
          key={item.id}
          onClick={() => onChoose(item)}
        >
          <PrivatePhoto mediaId={item.photo_media_id} />
          <Text className={styles.garmentName}>{item.name || '未命名衣物'}</Text>
          <Text className={styles.caption}>
            {item.id === currentId ? '✓ 当前搭配' : '点击替换'}
          </Text>
        </NativeButton>
      ))}
    </View>
  );
}
export function ReplacementSheet({
  session,
  requestId,
  selectedIds,
  targetId,
  onChoose,
  onClose,
}: {
  session: AuthSession;
  requestId: string;
  selectedIds: string[];
  targetId: string;
  onChoose: (item: Garment) => void;
  onClose: () => void;
}) {
  const exclude = selectedIds.filter((id) => id !== targetId);
  const candidates = useInfiniteQuery({
    queryKey: [
      ...sessionQueryKey(session, 'recommendations', requestId, 'candidates'),
      JSON.stringify(exclude),
    ],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      recommendationApi.candidates(requestId, exclude, pageParam, signal),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
  });
  const items = candidates.data?.pages.flatMap((page) => page.items) ?? [];
  const duplicate = new Set(items.map((item) => item.id)).size !== items.length;
  return (
    <Sheet title="替换单品" onClose={onClose}>
      <View className={styles.result}>
        <Notice>
          从本人当前合规的可穿衣物中选择，不限同一类别。点击即替换当前单品，其余单品保留；不会记录穿着。
        </Notice>
        {candidates.isPending ? <StatePanel state="loading" title="正在读取可替换衣物" /> : null}
        {candidates.isError || duplicate ? (
          <StatePanel
            state="error"
            title="候选读取失败"
            detail={duplicate ? '候选已变化，请关闭后重试。' : errorMessage(candidates.error)}
            onRetry={() => {
              void candidates.refetch();
            }}
          />
        ) : null}
        {!candidates.isPending && !candidates.isError && !items.length ? (
          <StatePanel
            state="empty"
            title="暂时没有可替换衣物"
            detail="可以管理衣柜或调整偏好后重新生成。"
          />
        ) : null}
        {!duplicate && !candidates.isError ? (
          <ReplacementChoices items={items} currentId={targetId} onChoose={onChoose} />
        ) : null}
        {candidates.hasNextPage && !duplicate ? (
          <Button
            variant="secondary"
            loading={candidates.isFetchingNextPage}
            onClick={() => {
              void candidates.fetchNextPage();
            }}
          >
            加载更多衣物
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
      </View>
    </Sheet>
  );
}
