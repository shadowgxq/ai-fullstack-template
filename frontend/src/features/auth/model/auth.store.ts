import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { setAuthToken, setUnauthorizedHandler } from '../../../shared/api';
import type { AuthUser } from './auth.types';

const SESSION_KEY = 'app.auth';
const REMEMBER_KEY = 'app.auth.remember';

function readRemember(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeRemember(remember: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, String(remember));
  } catch {
    // Storage can be unavailable in restricted browsing contexts.
  }
}

function pickStorage(remember: boolean): Storage | undefined {
  try {
    return remember ? localStorage : sessionStorage;
  } catch {
    return undefined;
  }
}

const rememberAwareStorage: StateStorage = {
  getItem: (name) => pickStorage(readRemember())?.getItem(name) ?? null,
  setItem: (name, value) => pickStorage(readRemember())?.setItem(name, value),
  removeItem: (name) => pickStorage(readRemember())?.removeItem(name),
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  remember: boolean;
  setSession: (token: string, user: AuthUser) => void;
  setRemember: (remember: boolean) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      remember: readRemember(),
      setSession: (token, user) => {
        setAuthToken(token);
        set({ token, user });
      },
      setRemember: (remember) => {
        writeRemember(remember);
        pickStorage(!remember)?.removeItem(SESSION_KEY);
        set({ remember });
      },
      clear: () => {
        setAuthToken(null);
        set({ token: null, user: null });
      },
    }),
    {
      name: SESSION_KEY,
      storage: createJSONStorage(() => rememberAwareStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) setAuthToken(state.token);
      },
    },
  ),
);

setUnauthorizedHandler(() => useAuthStore.getState().clear());
