import { useQuery } from '@tanstack/react-query';
import { Image, Text, View } from '@tarojs/components';
import { downloadPrivatePhoto } from '../../shared/api/media';
import { useWardrobeSession } from './session';
import { sessionQueryKey } from '../../shared/query/client';
import styles from './wardrobe.module.scss';

export function PrivatePhoto({
  mediaId,
  detail = false,
}: {
  mediaId: string | null;
  detail?: boolean;
}) {
  const session = useWardrobeSession();
  const image = useQuery({
    queryKey: sessionQueryKey(session, 'media', mediaId ?? ''),
    queryFn: ({ signal }) => downloadPrivatePhoto(mediaId!, signal),
    enabled: Boolean(session && mediaId),
  });
  if (image.data && session)
    return (
      <Image
        src={image.data}
        className={detail ? styles.detailPhoto : styles.photo}
        mode="aspectFill"
      />
    );
  return (
    <View className={`${styles.photoPlaceholder} ${detail ? styles.detailPhoto : ''}`}>
      <Text>{!mediaId ? '暂无照片' : image.isError ? '图片加载失败' : '图片加载中'}</Text>
    </View>
  );
}
