import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { setAuthToken, setUnauthorizedHandler } from '../../../shared/api';
import type { AuthUser } from './auth.types';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  setSession: (token: string, user: AuthUser) => void;
  clear: () => void;
};

/** 登录会话（zustand + persist）。token 同步推给 shared/api 的请求拦截器。 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => {
        setAuthToken(token);
        set({ token, user });
      },
      clear: () => {
        setAuthToken(null);
        set({ token: null, user: null });
      },
    }),
    {
      name: 'abk.auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          setAuthToken(state.token);
        }
      },
    },
  ),
);

// 带着 token 收到 401（会话过期/失效）时清除本地会话，请求层经此回调解耦业务层。
setUnauthorizedHandler(() => {
  useAuthStore.getState().clear();
});
