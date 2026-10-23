import { Image, Text, View } from '@tarojs/components';
import { useQuery } from '@tanstack/react-query';
import { downloadPrivatePhoto } from '../../shared/api/media';
import { sessionQueryKey } from '../../shared/query/client';
import { useWardrobeSession } from '../wardrobe/session';
import { useTheme } from '../../shared/theme/preferences';
import styles from './profile.module.scss';

export function Avatar({
  mediaId,
  preview,
  large = false,
}: {
  mediaId: string | null;
  preview?: string | null;
  large?: boolean;
}) {
  const session = useWardrobeSession();
  const theme = useTheme();
  const image = useQuery({
    queryKey: sessionQueryKey(session, 'media', mediaId ?? ''),
    queryFn: ({ signal }) => downloadPrivatePhoto(mediaId!, signal),
    enabled: Boolean(session && mediaId && !preview),
  });
  const path = preview || image.data;
  return (
    <View className={`${styles.avatar} ${large ? styles.avatarLarge : ''}`}>
      {path && session ? (
        <Image className={styles.avatarImage} src={path} mode="aspectFill" />
      ) : mediaId && image.isError ? (
        <Text className={styles.caption}>头像加载失败</Text>
      ) : (
        <Image
          className={styles.avatarFallback}
          src={`/assets/library-icons/user-round-${theme}-primary.png`}
        />
      )}
    </View>
  );
}
