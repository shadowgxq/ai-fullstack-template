import { useRef } from 'react';
import { Text, View, Slot, Button as NativeButton } from '@tarojs/components';
import { LibraryIcon } from './visuals';
import { swipeActionWidth, type ExampleRow } from './interaction-model';
import styles from './gestures-demo.module.scss';

export function SwipeRow({
  row,
  openRowId,
  onOpenChange,
  onDetails,
  onSave,
  onDelete,
}: {
  row: ExampleRow;
  openRowId: string | null;
  onOpenChange: (id: string | null) => void;
  onDetails: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const hadOpenRow = useRef(false);
  return (
    <View className={styles.swipeRow}>
      <library-swipe-cell
        right-width={swipeActionWidth}
        opened={openRowId === row.id}
        onStart={() => {
          hadOpenRow.current = openRowId !== null;
          if (openRowId && openRowId !== row.id) onOpenChange(null);
        }}
        onChange={(event) => onOpenChange(event.detail.opened ? row.id : null)}
        onCellclick={(event) => {
          if (event.detail.wasOpen || hadOpenRow.current) {
            hadOpenRow.current = false;
            onOpenChange(null);
            return;
          }
          onDetails();
        }}
      >
        <Slot className={styles.swipeActions} name="right">
          <NativeButton
            ariaLabel={row.saved ? `取消收藏${row.title}` : `收藏${row.title}`}
            onClick={(event) => {
              event.stopPropagation();
              onSave();
            }}
          >
            {row.saved ? '取消收藏' : '收藏'}
          </NativeButton>
          <NativeButton
            ariaLabel={`删除${row.title}`}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            删除
          </NativeButton>
        </Slot>
        <View className={styles.swipeInner} ariaRole="button" ariaLabel={`查看${row.title}`}>
          <View className={styles.rowCopy}>
            <View className={styles.rowTitleLine}>
              <Text className={styles.rowTitle}>{row.title}</Text>
              {row.saved ? <Text className={styles.saved}>已收藏</Text> : null}
            </View>
            <Text className={styles.rowDescription}>{row.detail}</Text>
          </View>
          <LibraryIcon name="arrow" tone="muted" />
        </View>
      </library-swipe-cell>
    </View>
  );
}
