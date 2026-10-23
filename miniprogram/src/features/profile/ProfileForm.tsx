import { Button as NativeButton, Input, Label, Text, View } from '@tarojs/components';
import { Button, Notice } from '../../shared/ui';
import { isRecord } from '../../shared/api/errors';
import { Avatar } from './Avatar';
import type { ProfileDraft } from './draft';
import styles from './profile.module.scss';
import { WardrobeIcon } from '../wardrobe/Icon';

export function ProfileForm({
  draft,
  disabled,
  uploading,
  preview,
  error,
  uploadError,
  nicknameError,
  onNickname,
  onAvatar,
  onAvatarError,
  onRemove,
  onRetry,
  onReview,
  uncertain = false,
}: {
  draft: ProfileDraft;
  disabled: boolean;
  uploading: boolean;
  preview: string | null;
  error: string | null;
  uploadError: string | null;
  nicknameError: string | null;
  onNickname: (value: string) => void;
  onAvatar: (path: string) => void;
  onAvatarError: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onReview: (passed: boolean) => void;
  uncertain?: boolean;
}) {
  return (
    <View className={styles.dialogBody}>
      <View className={styles.avatarRow}>
        <View className={styles.avatarDecoration} />
        <View className={styles.avatarDecoration} />
        <View className={styles.avatarDecoration} />
        <NativeButton
          className={styles.avatarChoice}
          ariaLabel="选择头像"
          openType="chooseAvatar"
          disabled={disabled || uploading}
          onChooseAvatar={(event) => {
            if (
              !disabled &&
              !uploading &&
              isRecord(event.detail) &&
              typeof event.detail.avatarUrl === 'string' &&
              event.detail.avatarUrl.trim()
            )
              onAvatar(event.detail.avatarUrl);
          }}
          onError={(event) => {
            if (
              !disabled &&
              !uploading &&
              !(
                isRecord(event.detail) &&
                typeof event.detail.errMsg === 'string' &&
                /cancel/i.test(event.detail.errMsg)
              )
            )
              onAvatarError();
          }}
        >
          <Avatar mediaId={draft.avatarMediaId} preview={preview} />
          <View className={styles.cameraMark}>
            <WardrobeIcon name="camera" />
          </View>
        </NativeButton>
      </View>
      {draft.avatarMediaId || preview ? (
        <Button variant="secondary" disabled={disabled || uploading} onClick={onRemove}>
          清除头像
        </Button>
      ) : null}
      {uploading ? <Notice>头像上传中，请稍候</Notice> : null}
      {uploadError ? (
        <Notice tone="error">
          {uploadError}
          <Button variant="secondary" disabled={disabled || uploading} onClick={onRetry}>
            重试头像上传
          </Button>
        </Notice>
      ) : null}
      <View className={styles.field}>
        <Label for="profile-nickname" className={styles.label}>
          昵称
        </Label>
        <View className={styles.nicknameBox}>
          <Input
            id="profile-nickname"
            type="nickname"
            className={styles.nickname}
            value={draft.nickname}
            placeholder="衣柜用户"
            maxlength={80}
            disabled={disabled}
            adjustPosition
            cursorSpacing={24}
            onInput={(event) => {
              if (!disabled) onNickname(event.detail.value);
            }}
            onNickNameReview={(event) => {
              if (!disabled && isRecord(event.detail) && typeof event.detail.pass === 'boolean')
                onReview(event.detail.pass);
            }}
          />
          {draft.nickname ? (
            <NativeButton
              className={styles.clearNickname}
              ariaLabel="清空昵称"
              disabled={disabled}
              onClick={() => {
                if (!disabled) onNickname('');
              }}
            >
              ×
            </NativeButton>
          ) : null}
        </View>
      </View>
      {nicknameError ? <Notice tone="error">{nicknameError}</Notice> : null}
      <Text className={styles.editorCaption}>
        头像和昵称仅自己可见，不影响衣柜与穿搭推荐的使用。
      </Text>
      {uncertain ? <Notice>上次保存结果尚未确认，请先重试原操作；输入已保留。</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </View>
  );
}
