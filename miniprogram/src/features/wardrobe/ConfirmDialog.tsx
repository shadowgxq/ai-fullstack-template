import { Button as NativeButton, Text, View } from '@tarojs/components';
import { Button, Notice } from '../../shared/ui';
import styles from './wardrobe.module.scss';

/** 归档、退出和删除共用 m0rZ7 确认结构，业务后果由调用者提供。 */
export function ConfirmDialog({
  title,
  detail,
  confirmLabel,
  busy = false,
  error,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  detail: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View
      className={styles.dialogOverlay}
      catchMove
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <View className={styles.dialog} onClick={(event) => event.stopPropagation()}>
        <View className={styles.sheetHeading}>
          <Text>{title}</Text>
          <NativeButton
            className={styles.close}
            ariaLabel="关闭"
            disabled={busy}
            onClick={onCancel}
          >
            ×
          </NativeButton>
        </View>
        <Text className={styles.caption}>{detail}</Text>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <View className={styles.dialogActions}>
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            取消
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </View>
      </View>
    </View>
  );
}
