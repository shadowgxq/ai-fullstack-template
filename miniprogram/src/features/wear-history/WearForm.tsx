import type { ReactNode } from 'react';
import { Button as NativeButton, Picker, Text, View } from '@tarojs/components';
import { Notice } from '../../shared/ui';
import { PrivatePhoto } from '../wardrobe/PrivatePhoto';
import { shanghaiToday } from './date';
import type { WearDraft } from './draft';
import styles from './wear-history.module.scss';
import { WardrobeIcon } from '../wardrobe/Icon';

export function WearGarmentPreview({
  garmentId,
  name,
  photoMediaId,
}: {
  garmentId: string;
  name: string | null;
  photoMediaId: string | null;
}) {
  return (
    <View key={garmentId} className={styles.preview}>
      <PrivatePhoto mediaId={photoMediaId} />
      <Text className={styles.itemName}>{name || '未命名衣物'}</Text>
    </View>
  );
}
export function WearForm({
  draft,
  onChange,
  onAdjust,
  disabled = false,
  error,
  children,
}: {
  draft: WearDraft;
  onChange: (draft: WearDraft) => void;
  onAdjust: () => void;
  disabled?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <View className={styles.body}>
      <Text className={styles.caption}>确认实际穿过后再保存。推荐不会自动计入历史。</Text>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <View className={styles.stack}>
        <Text className={styles.fieldLabel}>穿着日期</Text>
        <Picker
          mode="date"
          value={draft.wearDate}
          end={shanghaiToday()}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, wearDate: event.detail.value })}
        >
          <View className={`${styles.date} ${disabled ? styles.disabled : ''}`}>
            <Text>{draft.wearDate}</Text>
            <WardrobeIcon name="chevron-down" tone="muted" />
          </View>
        </Picker>
        <Text className={styles.smallCaption}>按北京时间（UTC+8）记录，可补录过去日期。</Text>
      </View>
      <View className={styles.row}>
        <Text className={styles.label}>实际穿着的衣物 · {draft.garmentIds.length} 件</Text>
        <NativeButton className={styles.adjustAction} disabled={disabled} onClick={onAdjust}>
          调整衣物
        </NativeButton>
      </View>
      <View className={styles.previewGrid}>{children}</View>
      <View className={styles.explanation}>
        <Text className={styles.label}>这次穿着将记为 1 条记录</Text>
        <Text className={styles.caption}>每件衣物在这条记录中计 1 次。同日可以记录多套搭配。</Text>
      </View>
    </View>
  );
}

export function DateRangeFields({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
}) {
  return (
    <View className={styles.stack}>
      <View className={styles.stack}>
        <Text className={styles.label}>开始日期</Text>
        <Picker
          mode="date"
          value={start || shanghaiToday()}
          onChange={(event) => onStart(event.detail.value)}
        >
          <View className={styles.date}>{start || '未设置'}</View>
        </Picker>
      </View>
      <View className={styles.stack}>
        <Text className={styles.label}>结束日期</Text>
        <Picker
          mode="date"
          value={end || shanghaiToday()}
          onChange={(event) => onEnd(event.detail.value)}
        >
          <View className={styles.date}>{end || '未设置'}</View>
        </Picker>
      </View>
    </View>
  );
}
