import type { WardrobeOptions } from '../wardrobe/api';

export interface PreferencesDraft {
  likedStyles: string[];
  likedColors: string[];
  avoidedStyles: string[];
  avoidedColors: string[];
  likedOccasions: string[];
  avoidedOccasions: string[];
  comfortNotes: string;
}
export const preferenceGroups = [
  { field: 'likedStyles', label: '喜欢的风格', options: 'styles' },
  { field: 'likedColors', label: '喜欢的颜色', options: 'colors' },
  { field: 'avoidedStyles', label: '避免的风格', options: 'styles' },
  { field: 'avoidedColors', label: '避免的颜色', options: 'colors' },
  { field: 'likedOccasions', label: '喜欢的场合', options: 'occasions' },
  { field: 'avoidedOccasions', label: '避免的场合', options: 'occasions' },
] as const;
export type PreferenceGroup = (typeof preferenceGroups)[number]['field'];
export type PreferencesErrors = Partial<Record<PreferenceGroup | 'comfortNotes', string>>;
export function emptyPreferencesDraft(): PreferencesDraft {
  return {
    likedStyles: [],
    likedColors: [],
    avoidedStyles: [],
    avoidedColors: [],
    likedOccasions: [],
    avoidedOccasions: [],
    comfortNotes: '',
  };
}
export function togglePreference(
  draft: PreferencesDraft,
  field: PreferenceGroup,
  id: string,
): PreferencesDraft {
  return {
    ...draft,
    [field]: draft[field].includes(id)
      ? draft[field].filter((value) => value !== id)
      : [...draft[field], id],
  };
}
export function validatePreferencesDraft(
  draft: PreferencesDraft,
  options: WardrobeOptions,
): PreferencesErrors {
  const errors: PreferencesErrors = {};
  for (const group of preferenceGroups) {
    const values = draft[group.field];
    if (
      values.length > 32 ||
      values.some((id) => !options[group.options].some((option) => option.id === id))
    )
      errors[group.field] = '请选择目录中的有效选项';
  }
  for (const [liked, avoided, label] of [
    ['likedStyles', 'avoidedStyles', '风格'],
    ['likedColors', 'avoidedColors', '颜色'],
    ['likedOccasions', 'avoidedOccasions', '场合'],
  ] as const) {
    const overlap = draft[liked].filter((id) => draft[avoided].includes(id));
    if (overlap.length) {
      const source = preferenceGroups.find((group) => group.field === liked)!.options;
      const labels = overlap
        .map((id) => options[source].find((option) => option.id === id)?.label ?? id)
        .join('、');
      errors[liked] = errors[avoided] = `${label}不能同时喜欢和避免：${labels}，请调整其中一组`;
    }
  }
  if ([...draft.comfortNotes.trim()].length > 500)
    errors.comfortNotes = '舒适度要求最多填写500个字符';
  return errors;
}
