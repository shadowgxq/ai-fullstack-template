import { useTranslation } from 'react-i18next';

import { useChangePasswordModal } from '../../model/change-password-modal.store';
import { ChangePasswordForm } from './ChangePasswordForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';

/**
 * 修改密码弹窗。与登录同样就地覆盖当前页而不跳路由：改密码是从账户菜单
 * 发起的顺手操作，跳走再跳回来会丢当前页面的上下文。
 */
export function ChangePasswordModal() {
  const { t } = useTranslation();
  const open = useChangePasswordModal((state) => state.open);
  const setOpen = useChangePasswordModal((state) => state.setOpen);
  const closeChangePassword = useChangePasswordModal((state) => state.closeChangePassword);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        size="md"
        className="max-h-[calc(100dvh-var(--space-8))] overflow-y-auto"
        closeLabel={t('auth.close')}
      >
        <DialogHeader>
          <DialogTitle>{t('auth.changePassword.title')}</DialogTitle>
          <DialogDescription>{t('auth.changePassword.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <ChangePasswordForm onDone={closeChangePassword} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
