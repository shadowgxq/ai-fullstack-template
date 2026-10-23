import { useEffect, useRef, useState } from 'react';
import { Text, View } from '@tarojs/components';
import { Button, Notice } from '../../shared/ui';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { api, type Profile } from '../../shared/api/gateway';
import { ApiError, errorMessage } from '../../shared/api/errors';
import { queryClient, sessionQueryKey } from '../../shared/query/client';
import { WardrobePage } from '../wardrobe/Page';
import { AvatarUpload, ProfileEditor as ProfileEditorState } from './editor';
import { draftFromProfile } from './draft';
import { ProfileForm } from './ProfileForm';
import { Avatar } from './Avatar';
import styles from './profile.module.scss';

export function ProfileEditor({
  session,
  initial,
  onClose,
}: {
  session: AuthSession;
  initial: Profile;
  onClose: () => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(() => draftFromProfile(initial));
  const [editor] = useState(() => new ProfileEditorState(session, initial));
  const [upload] = useState(() => new AvatarUpload());
  const lifetime = useRef(new AbortController());
  const saveLock = useRef(false);
  const uploadLock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<Profile | null>(null);
  const [readingLatest, setReadingLatest] = useState(false);
  useEffect(
    () => () => {
      lifetime.current.abort();
      editor.close();
      upload.clear();
    },
    [editor, upload],
  );
  const active = () => !lifetime.current.signal.aborted && getAuthSession() === session;
  const close = async () => {
    try {
      await onClose();
    } catch {
      if (active()) setError('资料已保存，页面暂时无法返回，请点击完成重试');
    }
  };
  const uploadAvatar = async () => {
    if (!active() || uploadLock.current || saveLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    setUploadError(null);
    try {
      const media = await upload.upload(session, lifetime.current.signal);
      if (active()) setDraft((current) => ({ ...current, avatarMediaId: media.id }));
    } catch (error) {
      if (active()) setUploadError(errorMessage(error));
    } finally {
      uploadLock.current = false;
      if (active()) setUploading(false);
    }
  };
  const save = async () => {
    if (!active() || saveLock.current || uploadLock.current || nicknameError) return;
    if (saved) {
      saveLock.current = true;
      setSaving(true);
      try {
        await close();
      } finally {
        saveLock.current = false;
        if (active()) setSaving(false);
      }
      return;
    }
    if (upload.path && !draft.avatarMediaId) {
      setError('请先完成头像上传，或清除头像后保存');
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setError(null);
    setConflict(false);
    try {
      const profile = await editor.save(draft, lifetime.current.signal);
      if (!active()) return;
      setSaved(true);
      setUncertain(false);
      queryClient.setQueryData(sessionQueryKey(session, 'profile'), profile);
      await queryClient
        .invalidateQueries({ queryKey: sessionQueryKey(session, 'profile'), exact: true })
        .catch(() => undefined);
      if (active()) await close();
    } catch (error) {
      if (active()) {
        setUncertain(editor.uncertain);
        setConflict(error instanceof ApiError && error.status === 409);
        setError(errorMessage(error));
      }
    } finally {
      saveLock.current = false;
      if (active()) setSaving(false);
    }
  };
  return (
    <WardrobePage title="编辑个人资料" tone="settings" navigationLocked={saving}>
      <View className={styles.editorBody}>
        <ProfileForm
          draft={draft}
          disabled={saving || uncertain || saved}
          uploading={uploading}
          preview={preview}
          error={error}
          uploadError={uploadError}
          nicknameError={nicknameError}
          uncertain={uncertain}
          onNickname={(nickname) => {
            if (active() && !saveLock.current && !uncertain && !saved) {
              setDraft((current) => ({ ...current, nickname }));
              setNicknameError(null);
            }
          }}
          onReview={(passed) => {
            if (active() && !saveLock.current && !uncertain && !saved)
              setNicknameError(passed ? null : '昵称未通过平台审核，请重新填写');
          }}
          onAvatar={(path) => {
            if (!active() || saveLock.current || uploadLock.current || uncertain || saved) return;
            upload.select(path);
            setPreview(path);
            setDraft((current) => ({ ...current, avatarMediaId: null }));
            void uploadAvatar();
          }}
          onAvatarError={() => {
            if (active()) setUploadError('头像选择未完成，请重试');
          }}
          onRemove={() => {
            if (active() && !saveLock.current && !uploadLock.current && !uncertain && !saved) {
              upload.clear();
              setPreview(null);
              setUploadError(null);
              setDraft((current) => ({ ...current, avatarMediaId: null }));
            }
          }}
          onRetry={() => {
            void uploadAvatar();
          }}
        />
        {conflict ? (
          <>
            <Notice>
              当前输入已保留。核对最新资料后，可返回并重新编辑；不会自动覆盖本次输入。
            </Notice>
            <Button
              variant="secondary"
              loading={readingLatest}
              onClick={() => {
                if (!active() || readingLatest) return;
                setReadingLatest(true);
                void (async () => {
                  try {
                    const result = await api.profile(lifetime.current.signal);
                    if (!active()) return;
                    if (result.user_id !== session.userId) throw new Error('个人资料账户不匹配');
                    setLatest(result);
                    queryClient.setQueryData(sessionQueryKey(session, 'profile'), result);
                  } catch (error) {
                    if (active()) setError(errorMessage(error));
                  } finally {
                    if (active()) setReadingLatest(false);
                  }
                })();
              }}
            >
              读取最新资料
            </Button>
            {latest ? (
              <View>
                <Text>最新昵称：{latest.nickname || '未填写'}</Text>
                <Avatar mediaId={latest.avatar_media_id} />
                <Text>{latest.avatar_media_id ? '最新资料已设置头像' : '最新资料未设置头像'}</Text>
              </View>
            ) : null}
          </>
        ) : null}
        <View className={styles.saveProfile}>
          <Button
            loading={saving}
            disabled={uploading || Boolean(nicknameError)}
            onClick={() => {
              void save();
            }}
          >
            {saved ? '完成' : uncertain ? '重试确认上次保存' : '保存资料'}
          </Button>
        </View>
      </View>
    </WardrobePage>
  );
}
