import type { Profile, ProfilePatch } from '../../shared/api/gateway';

export interface ProfileDraft {
  nickname: string;
  avatarMediaId: string | null;
}
export function draftFromProfile(profile: Profile): ProfileDraft {
  return { nickname: profile.nickname ?? '', avatarMediaId: profile.avatar_media_id };
}
export function validateProfileDraft(draft: ProfileDraft): string | null {
  return [...draft.nickname.trim()].length > 80 ? '昵称最多填写80个字符' : null;
}
export function profileInput(draft: ProfileDraft, version: number): ProfilePatch {
  return {
    expected_version: version,
    nickname: draft.nickname.trim() || null,
    avatar_media_id: draft.avatarMediaId,
  };
}
