import { Label, Text, Textarea, View } from '@tarojs/components';
import { Button, Notice } from '../../shared/ui';
import { Chips } from '../wardrobe/controls';
import type { WardrobeOptions } from '../wardrobe/api';
import {
  emptyPreferencesDraft,
  preferenceGroups,
  togglePreference,
  type PreferencesDraft,
  type PreferencesErrors,
} from './draft';
import styles from './preferences.module.scss';

export function PreferencesForm({
  draft,
  options,
  errors,
  disabled = false,
  onChange,
}: {
  draft: PreferencesDraft;
  options: WardrobeOptions;
  errors: PreferencesErrors;
  disabled?: boolean;
  onChange: (value: PreferencesDraft) => void;
}) {
  return (
    <View className={styles.body}>
      <Text className={styles.caption}>这些是长期偏好。未设置时也可以获得推荐。</Text>
      {preferenceGroups.map((group) => (
        <View key={group.field} className={styles.group}>
          <Text className={styles.heading}>{group.label}</Text>
          <Chips
            options={options[group.options]}
            values={draft[group.field]}
            disabled={disabled}
            onChange={(id) => {
              if (!disabled) onChange(togglePreference(draft, group.field, id));
            }}
          />
          {errors[group.field] ? <Notice tone="error">{errors[group.field]}</Notice> : null}
        </View>
      ))}
      <View className={styles.group}>
        <Label for="preferences-comfort" className={styles.heading}>
          舒适度偏好（选填）
        </Label>
        <Textarea
          id="preferences-comfort"
          className={styles.notes}
          value={draft.comfortNotes}
          placeholder="例如怕冷或偏好宽松"
          maxlength={500}
          disabled={disabled}
          adjustPosition
          cursorSpacing={24}
          onInput={(event) => {
            if (!disabled) onChange({ ...draft, comfortNotes: event.detail.value });
          }}
        />
        {errors.comfortNotes ? <Notice tone="error">{errors.comfortNotes}</Notice> : null}
      </View>
      <Text className={styles.helper}>
        舒适度描述供 AI 参考，不保证满足；风格、颜色和场合的避免项会严格排除。
      </Text>
      <Button
        variant="secondary"
        disabled={disabled}
        onClick={() => {
          if (!disabled) onChange(emptyPreferencesDraft());
        }}
      >
        清除所有偏好
      </Button>
    </View>
  );
}
