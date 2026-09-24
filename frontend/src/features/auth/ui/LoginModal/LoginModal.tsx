import { useTranslation } from 'react-i18next';

import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { useLoginModal } from '../../model/login-modal.store';
import { AuthForm } from '../AuthForm';

/**
 * 登录弹窗。覆盖当前页、不跳路由：用户在首页填到一半被要求登录时，
 * 跳走再跳回来会丢上下文，弹窗登完就地关闭。
 *
 * 基于 shadcn Dialog（内部是 Radix），统一提供焦点陷阱、Esc 关闭、
 * 背景滚动锁与语义关联；尺寸、遮罩、圆角与间距由共享 Dialog contract 提供。
 */
export function LoginModal() {
  const { t } = useTranslation();
  const open = useLoginModal((state) => state.open);
  const setOpen = useLoginModal((state) => state.setOpen);
  const closeLogin = useLoginModal((state) => state.closeLogin);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* DialogContent 自己负责 Portal 与遮罩，避免重复挂载造成定位和层级偏移。 */}
      <DialogContent
        size="md"
        aria-describedby={undefined}
        closeLabel={t('auth.close')}
        className="max-h-[calc(100dvh-var(--space-8))] overflow-y-auto"
      >
        {/* 可见内容直接从登录方式开始；标题保留给可访问性语义。 */}
        <DialogHeader className="sr-only">
          <DialogTitle>{t('auth.title')}</DialogTitle>
        </DialogHeader>

        {/* 登录成功就地关闭，停留在用户原本的页面上。 */}
        <DialogBody className="min-h-0">
          <AuthForm
            onAuthenticated={() => closeLogin()}
            className="gap-[calc(var(--content-gap)+var(--space-3))]"
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
