import { create } from 'zustand';

type LoginModalState = {
  open: boolean;
  /**
   * 登录成功后要替用户续做的事。由唤起方在 openLogin 时登记，
   * 只在登录成功时执行一次，弹窗被取消则丢弃。
   */
  pendingAction: (() => void) | null;
  openLogin: (onAuthenticated?: () => void) => void;
  closeLogin: () => void;
  setOpen: (open: boolean) => void;
};

/**
 * 登录弹窗开关。做成全局 store 而不是某个组件的局部 state，是因为唤起点有多处：
 * 顶栏与设置菜单的登录入口，以及保存报告、历史页预览态、结果页绑定这三处未登录拦截。
 * 登录不跳路由，弹窗覆盖当前页，成功后就地关闭，用户不丢上下文。
 *
 * pendingAction 必须在关闭时清空：否则用户在结果页点了「保存」又把弹窗关掉，
 * 之后从顶栏登录时会莫名其妙触发那次保存。
 */
export const useLoginModal = create<LoginModalState>((set) => ({
  open: false,
  pendingAction: null,
  // typeof 判断不是多余的：openLogin 常被挂到 onClick 上，一旦写成 onClick={openLogin}
  // 而不是 onClick={() => openLogin()}，React 会把鼠标事件当作续做动作传进来，
  // 之后 pendingAction?.() 就会去调用一个事件对象。
  openLogin: (onAuthenticated) =>
    set({
      open: true,
      pendingAction: typeof onAuthenticated === 'function' ? onAuthenticated : null,
    }),
  closeLogin: () => set({ open: false, pendingAction: null }),
  setOpen: (open) => set(open ? { open } : { open, pendingAction: null }),
}));
