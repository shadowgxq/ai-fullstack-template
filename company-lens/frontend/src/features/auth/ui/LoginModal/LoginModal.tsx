import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useLoginModal } from '../../model/login-modal.store';
import { AuthForm } from '../AuthForm';
import styles from './LoginModal.module.css';

/**
 * 登录弹窗。覆盖当前页、不跳路由：用户在结果页想把报告存进账户时，
 * 跳走再跳回来会丢上下文，弹窗登完就地关闭，还能顺手把他原本要做的事做掉。
 *
 * 用 Radix Dialog 而不是手写：焦点陷阱、Esc 关闭、背景滚动锁、
 * aria-modal 与标题关联都是它自带的，手写容易漏。
 */
export function LoginModal() {
  const { t } = useTranslation();
  const open = useLoginModal((state) => state.open);
  const setOpen = useLoginModal((state) => state.setOpen);

  /**
   * 登录成功：先把登记的续做动作执行掉，再关闭弹窗。
   * 从 store 现取而不是订阅到组件上，避免 pendingAction 变化引发无谓重渲。
   */
  function handleAuthenticated() {
    const { pendingAction, closeLogin } = useLoginModal.getState();

    closeLogin();
    pendingAction?.();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          {/* 关闭按钮挂在卡片上、不在滚动容器里，才能始终钉在右上角 */}
          <Dialog.Close asChild>
            <button type="button" className={styles.close} aria-label={t('auth.close')}>
              <X size={18} aria-hidden="true" />
            </button>
          </Dialog.Close>

          <div className={styles.body}>
            <Dialog.Title className={styles.srOnly}>{t('auth.title')}</Dialog.Title>

            <AuthForm onAuthenticated={handleAuthenticated} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
