import { Button, Text, View } from '@tarojs/components';
import { PrivatePhoto } from './PrivatePhoto';
import type { Choice } from './controls';
import type { GarmentList } from './api';
import styles from './wardrobe.module.scss';

export function GarmentGrid({
  items,
  categories,
  colors,
  onOpen,
}: {
  items: GarmentList['items'];
  categories: readonly Choice[];
  colors: readonly Choice[];
  onOpen: (id: string) => void;
}) {
  return (
    <View className={styles.grid}>
      {items.map((garment) => (
        <Button key={garment.id} className={styles.tile} onClick={() => onOpen(garment.id)}>
          <PrivatePhoto mediaId={garment.photo_media_id ?? null} />
          <Text className={styles.tileName}>{garment.name || '未命名衣物'}</Text>
          <Text className={styles.caption}>
            {[
              categories.find((value) => value.id === garment.category)?.label ??
                garment.category ??
                '未分类',
              colors.find((value) => value.id === garment.color)?.label ?? garment.color,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Button>
      ))}
    </View>
  );
}
