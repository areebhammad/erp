import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  full_name?: string;
}

// User explicitly must NOT contain `accessToken`, `refreshToken`, or any tokens

export interface AuthState {
  user: User | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  setUser: (user: User, sessionId: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      sessionId: null,
      isAuthenticated: false,

      setUser: (user, sessionId) => {
        set({ user, sessionId, isAuthenticated: true });
      },

      clearAuth: () => {
        set({ user: null, sessionId: null, isAuthenticated: false });
        // dispatch __session_clear in localStorage
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('__session_clear', Date.now().toString());
          window.dispatchEvent(new Event('__session_clear'));
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
