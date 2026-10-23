import type { components } from '../../shared/api/schema.generated';
import { ApiError, isRecord } from '../../shared/api/errors';
import { parseEnvelope, requestJson } from '../../shared/api/request';
import type { PreferencesDraft, PreferenceGroup } from './draft';

export type Preferences = components['schemas']['PreferencesView'];
export type PreferencesPut = components['schemas']['PreferencesPut'];
export const preferenceFields = {
  likedStyles: 'liked_styles',
  likedColors: 'liked_colors',
  avoidedStyles: 'avoided_styles',
  avoidedColors: 'avoided_colors',
  likedOccasions: 'liked_occasions',
  avoidedOccasions: 'avoided_occasions',
} as const satisfies Record<PreferenceGroup, keyof PreferencesPut>;
function malformed(): never {
  throw new ApiError('穿搭偏好数据格式不正确，请重试', 'invalid-response');
}
function selection(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 32 ||
    !value.every(
      (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 40,
    ) ||
    new Set(value).size !== value.length
  )
    return malformed();
  return [...value];
}
export function parsePreferences(value: unknown): Preferences {
  if (
    !isRecord(value) ||
    typeof value.version !== 'number' ||
    !Number.isSafeInteger(value.version) ||
    value.version < 0 ||
    typeof value.catalog_version !== 'string' ||
    !value.catalog_version.trim() ||
    !(
      value.comfort_notes === null ||
      (typeof value.comfort_notes === 'string' &&
        value.comfort_notes === value.comfort_notes.trim() &&
        [...value.comfort_notes].length <= 500 &&
        value.comfort_notes.length > 0)
    )
  )
    return malformed();
  const result: Preferences = {
    version: value.version,
    catalog_version: value.catalog_version,
    comfort_notes: value.comfort_notes,
    liked_styles: selection(value.liked_styles),
    avoided_styles: selection(value.avoided_styles),
    liked_colors: selection(value.liked_colors),
    avoided_colors: selection(value.avoided_colors),
    liked_occasions: selection(value.liked_occasions),
    avoided_occasions: selection(value.avoided_occasions),
  };
  if (
    result.liked_styles.some((id) => result.avoided_styles.includes(id)) ||
    result.liked_colors.some((id) => result.avoided_colors.includes(id)) ||
    result.liked_occasions.some((id) => result.avoided_occasions.includes(id))
  )
    return malformed();
  return result;
}
const canonical = (values: string[]) => [...new Set(values)].sort();
export function preferencesInput(draft: PreferencesDraft, version: number): PreferencesPut {
  return {
    expected_version: version,
    liked_styles: canonical(draft.likedStyles),
    avoided_styles: canonical(draft.avoidedStyles),
    liked_colors: canonical(draft.likedColors),
    avoided_colors: canonical(draft.avoidedColors),
    liked_occasions: canonical(draft.likedOccasions),
    avoided_occasions: canonical(draft.avoidedOccasions),
    comfort_notes: draft.comfortNotes.trim() || null,
  };
}
export function draftFromPreferences(value: Preferences): PreferencesDraft {
  return {
    likedStyles: [...value.liked_styles],
    avoidedStyles: [...value.avoided_styles],
    likedColors: [...value.liked_colors],
    avoidedColors: [...value.avoided_colors],
    likedOccasions: [...value.liked_occasions],
    avoidedOccasions: [...value.avoided_occasions],
    comfortNotes: value.comfort_notes ?? '',
  };
}
export const preferencesApi = {
  read: (signal?: AbortSignal) =>
    requestJson('/api/v1/preferences', (value) => parseEnvelope(value, parsePreferences), {
      signal,
    }),
  save: (data: PreferencesPut, signal?: AbortSignal) =>
    requestJson('/api/v1/preferences', (value) => parseEnvelope(value, parsePreferences), {
      method: 'PUT',
      data,
      signal,
    }),
};
