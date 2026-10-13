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
  sessionGeneration: number;
  token: string | null;
  user: AuthUser | null;
  remember: boolean;
  setSession: (token: string, user: AuthUser) => void;
  setRemember: (remember: boolean) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      sessionGeneration: 0,
      token: null,
      user: null,
      remember: readRemember(),
      setSession: (token, user) => {
        setAuthToken(token);
        const current = get();
        const hasChanged = current.token !== token || current.user?.userId !== user.userId;
        set({ token, user, sessionGeneration: current.sessionGeneration + (hasChanged ? 1 : 0) });
      },
      setRemember: (remember) => {
        writeRemember(remember);
        pickStorage(!remember)?.removeItem(SESSION_KEY);
        set({ remember });
      },
      clear: () => {
        setAuthToken(null);
        const current = get();
        set({
          token: null,
          user: null,
          sessionGeneration: current.sessionGeneration + (current.token || current.user ? 1 : 0),
        });
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
