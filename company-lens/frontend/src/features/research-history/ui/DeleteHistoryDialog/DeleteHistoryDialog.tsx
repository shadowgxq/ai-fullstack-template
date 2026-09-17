import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../../shared/ui/Button';
import styles from './DeleteHistoryDialog.module.css';

export type DeleteHistoryDialogProps = {
  open: boolean;
  /** 待删除记录的展示名（公司名/对象名/原始输入），只用于对话框标题，不参与业务判断。 */
  recordLabel: string;
  isPending: boolean;
  /** 删除失败时展示的错误提示；不传则不渲染错误区域。 */
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * 删除历史记录的二次确认弹窗。
 * 文案严格对齐需求文档 20.6：确认文案固定，不按记录内容改写。
 */
export function DeleteHistoryDialog({
  open,
  recordLabel,
  isPending,
  errorMessage,
  onCancel,
  onConfirm,
}: DeleteHistoryDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onCancel();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby="delete-history-description">
          <Dialog.Title className={styles.title}>
            {t('history.deleteDialog.title', { name: recordLabel })}
          </Dialog.Title>
          <Dialog.Description id="delete-history-description" className={styles.description}>
            {t('history.deleteDialog.description')}
          </Dialog.Description>

          {errorMessage ? (
            <p className={styles.error} role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className={styles.actions}>
            <Button
              type="button"
              size="small"
              variant="secondary"
              disabled={isPending}
              onClick={onCancel}
            >
              {t('history.deleteDialog.cancel')}
            </Button>
            <Button
              type="button"
              size="small"
              variant="primary"
              isPending={isPending}
              onClick={onConfirm}
            >
              {t('history.deleteDialog.confirm')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
