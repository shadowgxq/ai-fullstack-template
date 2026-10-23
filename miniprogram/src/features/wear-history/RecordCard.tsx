import { Button, Text, View } from '@tarojs/components';
import type { ReactNode } from 'react';
import { RecordItem } from './RecordItems';
import type { WearRecord } from './api';
import styles from './wear-history.module.scss';

export function RecordCard({
  record,
  onOpen,
  onMenu,
  compact = false,
  menu,
}: {
  record: WearRecord;
  onOpen: () => void;
  onMenu?: () => void;
  compact?: boolean;
  menu?: ReactNode;
}) {
  if (compact)
    return (
      <Button className={styles.recentRecord} onClick={onOpen}>
        <View className={styles.recentPhotos}>
          {record.items.slice(0, 2).map((item) => (
            <RecordItem key={item.garment_id} item={item} compact />
          ))}
        </View>
        <View className={styles.recentCopy}>
          <Text className={styles.label}>最近穿着 · {record.wear_date}</Text>
          <Text className={styles.caption}>
            {record.items.map((item) => item.name_snapshot || '未命名衣物').join('、')}
          </Text>
        </View>
        <Text className={styles.caption}>查看 ›</Text>
      </Button>
    );
  return (
    <View className={styles.record}>
      <View className={styles.row}>
        <Text className={styles.recordDate}>{record.wear_date}</Text>
        {onMenu ? (
          <View className={styles.recordActions}>
            <Button className={styles.menuAction} ariaLabel="记录操作" onClick={onMenu}>
              •••
            </Button>
            {menu}
          </View>
        ) : null}
      </View>
      <Button className={styles.recordContent} ariaLabel="查看记录" onClick={onOpen}>
        <View className={styles.historyGrid}>
          {record.items.slice(0, 2).map((item) => (
            <RecordItem key={item.garment_id} item={item} compact />
          ))}
        </View>
        <Text className={styles.caption}>
          {record.items.map((item) => item.name_snapshot || '未命名衣物').join('、')}
        </Text>
      </Button>
    </View>
  );
}
