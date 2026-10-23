import { Text, View } from '@tarojs/components';
import type { WardrobeOptions } from '../wardrobe/api';
import { draftFromPreferences, type Preferences } from './api';
import { preferenceGroups } from './draft';
import styles from './preferences.module.scss';
export function PreferencesSummary({
  value,
  options,
}: {
  value: Preferences;
  options: WardrobeOptions;
}) {
  const draft = draftFromPreferences(value);
  return (
    <View className={styles.body}>
      <Text className={styles.heading}>最新已保存偏好</Text>
      {preferenceGroups.map((group) => (
        <View className={styles.group} key={group.field}>
          <Text className={styles.heading}>{group.label}</Text>
          <Text className={styles.caption}>
            {draft[group.field]
              .map((id) => options[group.options].find((item) => item.id === id)?.label ?? id)
              .join('、') || '未选择'}
          </Text>
        </View>
      ))}
      <Text className={styles.heading}>舒适度要求</Text>
      <Text className={styles.caption}>{value.comfort_notes || '未填写'}</Text>
    </View>
  );
}
