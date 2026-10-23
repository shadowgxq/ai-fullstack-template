import { useQuery } from '@tanstack/react-query';
import { Text, View } from '@tarojs/components';
import { wardrobeApi } from '../wardrobe/api';
import { useWardrobeSession } from '../wardrobe/session';
import { PrivatePhoto } from '../wardrobe/PrivatePhoto';
import { sessionQueryKey } from '../../shared/query/client';
import type { WearItem } from './api';
import styles from './wear-history.module.scss';

/** 名称/类别来自历史快照；照片只读当前本人衣物的私有媒体。 */
export function RecordItem({ item, compact = false }: { item: WearItem; compact?: boolean }) {
  const session = useWardrobeSession();
  const current = useQuery({
    queryKey: sessionQueryKey(session, 'garment', item.garment_id),
    queryFn: ({ signal }) => wardrobeApi.garment(item.garment_id, signal),
    enabled: Boolean(session),
  });
  const options = useQuery({
    queryKey: sessionQueryKey(session, 'wardrobe-options'),
    queryFn: ({ signal }) => wardrobeApi.options(signal),
    enabled: Boolean(session && !compact),
  });
  const category =
    options.data?.categories.find((option) => option.id === item.category_snapshot)?.label ??
    item.category_snapshot ??
    '未分类';
  return (
    <View className={styles.preview}>
      <View className={compact ? styles.historyPhoto : undefined}>
        {current.data ? (
          <PrivatePhoto mediaId={current.data.photo_media_id} />
        ) : (
          <View className={compact ? styles.historyPhotoFallback : styles.photoFallback}>
            <Text>{current.isError ? '当前照片不可用' : '读取当前照片'}</Text>
          </View>
        )}
      </View>
      {!compact ? (
        <Text className={styles.itemName}>{item.name_snapshot ?? '未命名衣物'}</Text>
      ) : null}
      {!compact ? <Text className={styles.caption}>{category}</Text> : null}
    </View>
  );
}
