import { Check } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthStore, useLoginModal } from '../../../auth';
import { getApiErrorMessage } from '../../../../shared/api';
import { isSaveReportError } from '../../model/save-report.gateway';
import { useBindTaskToAccount } from '../../model/save-report.mutations';
import styles from './SaveReportToHistory.module.css';

export type SaveReportToHistoryProps = {
  /** 当前报告对应的研究任务 ID。 */
  taskId: string;
};

/**
 * 「保存报告到历史分析」自包含组件（需求第十九章）。
 *
 * 报告页只需放一行 `<SaveReportToHistory taskId={...} />`，按钮、登录入口、绑定调用
 * 与全部状态展示都封装在内部，调用方不接触账户逻辑。
 *
 * 需求 19.2 的四条业务规则：
 * 1. 只绑定现有任务、不重新执行研究 —— 仅调用 bind 接口（见 save-report.mutations.ts）。
 * 2. 同一任务不能重复保存 —— 成功后进入 saved 终态，按钮禁用；服务端重复绑定也会返回
 *    ALREADY_BOUND，同样落到 saved 展示。
 * 3. 保存成功后按钮变为「已保存」—— saved 状态渲染 savedLabel。
 * 4. 已绑定其他账户的任务不能再次绑定 —— 后端对「已绑定」只有一个错误码，无法区分是不是
 *    本人此前绑定的，因此文案统一为「该报告已保存到某个账户，无法重复保存」，对两种情况
 *    都成立，不假装能区分。
 *
 * 未登录时就地弹出登录窗（不跳路由），并把本次绑定登记为「登录成功后续做」，登完自动保存。
 *
 * 早先的实现是跳登录页 + returnTo，且刻意不自动绑定——因为那是个共享的登录页，用户可能
 * 是从别处进去的，登录后被动绑定一个他并不想保存的任务就说不通了。改成弹窗后这个顾虑不
 * 存在：续做动作是本按钮这一次点击登记的，弹窗被取消就丢弃，不会串到别处发起的登录上。
 */
export function SaveReportToHistory({ taskId }: SaveReportToHistoryProps) {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));
  const openLogin = useLoginModal((state) => state.openLogin);
  const bind = useBindTaskToAccount();
  const [isSaved, setIsSaved] = useState(false);

  let errorText: string | null = null;
  if (bind.error) {
    if (isSaveReportError(bind.error) && bind.error.code !== 'generic') {
      errorText = t(`saveReport.errors.${bind.error.code}`);
    } else if (isSaveReportError(bind.error) && bind.error.serverMessage) {
      errorText = getApiErrorMessage(bind.error);
    } else {
      errorText = t('saveReport.errors.generic');
    }
  }

  function saveToHistory() {
    bind.mutate(taskId, {
      onSuccess: () => setIsSaved(true),
      // 服务端说已绑定时同样进入已保存终态：对用户而言结果一致，再点也不会成功。
      onError: (error) => {
        if (isSaveReportError(error) && error.code === 'ALREADY_BOUND') {
          setIsSaved(true);
        }
      },
    });
  }

  function handleClick() {
    if (isSaved || bind.isPending) {
      return;
    }

    if (!isAuthenticated) {
      openLogin(saveToHistory);
      return;
    }

    saveToHistory();
  }

  let label = t('saveReport.action');
  if (isSaved) {
    label = t('saveReport.saved');
  } else if (bind.isPending) {
    label = t('saveReport.saving');
  }

  return (
    <div className={styles.root}>
      <p className={styles.prompt}>
        {isAuthenticated ? t('saveReport.promptAuthenticated') : t('saveReport.promptAnonymous')}
      </p>

      <button
        type="button"
        className={styles.button}
        onClick={handleClick}
        disabled={isSaved || bind.isPending}
      >
        {isSaved ? <Check size={16} aria-hidden /> : null}
        {label}
      </button>

      {errorText && !isSaved ? (
        <p className={styles.error} role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
