import { create } from "zustand";
import { AuthService, AuthUser } from "./service";
import { storage } from "./lib/secureStorage";

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

export interface AuthActions {
  initialize: () => Promise<void>;
  cleanup: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (displayName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

// Module-level — so cleanup can properly cancel without React lifecycle issues
let _refreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRefresh(expiresInMs: number, store: AuthStore) {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  const refreshAt = Math.max(expiresInMs - 60_000, 0);
  _refreshTimer = setTimeout(() => {
    store.refreshSession();
  }, refreshAt);
}

function parseJwtExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return ((payload.exp as number) * 1000) - Date.now();
  } catch {
    return 14 * 60 * 1000; // fallback: 14 min
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: false,
  initialized: false,
  error: null,

  initialize: async () => {
    set({ loading: true });
    try {
      const { accessToken, refreshToken } = await storage.getTokens();
      if (!accessToken || !refreshToken) {
        set({ initialized: true, loading: false });
        return;
      }
      // Try to restore session — refresh if token expired
      try {
        const user = await AuthService.getMe(accessToken);
        set({ user, accessToken, refreshToken, initialized: true, loading: false });
        scheduleRefresh(parseJwtExpiry(accessToken), get());
      } catch {
        // Access token expired — try refresh
        try {
          const tokens = await AuthService.refreshTokens(refreshToken);
          await storage.saveTokens(tokens.accessToken, tokens.refreshToken);
          const user = await AuthService.getMe(tokens.accessToken);
          set({
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            initialized: true,
            loading: false,
          });
          scheduleRefresh(parseJwtExpiry(tokens.accessToken), get());
        } catch {
          await storage.clearTokens();
          set({ initialized: true, loading: false });
        }
      }
    } catch {
      set({ initialized: true, loading: false });
    }
  },

  cleanup: () => {
    if (_refreshTimer) {
      clearTimeout(_refreshTimer);
      _refreshTimer = null;
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { user, accessToken, refreshToken } = await AuthService.signIn({ email, password });
      await storage.saveTokens(accessToken, refreshToken);
      await storage.saveUser(user);
      set({ user, accessToken, refreshToken, loading: false });
      scheduleRefresh(parseJwtExpiry(accessToken), get());
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Sign in failed", loading: false });
      throw err;
    }
  },

  signUp: async (displayName, email, password) => {
    set({ loading: true, error: null });
    try {
      const { user, accessToken, refreshToken } = await AuthService.signUp({
        displayName,
        email,
        password,
        confirmPassword: password,
      });
      await storage.saveTokens(accessToken, refreshToken);
      await storage.saveUser(user);
      set({ user, accessToken, refreshToken, loading: false });
      scheduleRefresh(parseJwtExpiry(accessToken), get());
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Sign up failed", loading: false });
      throw err;
    }
  },

  signOut: async () => {
    const { refreshToken } = get();
    set({ loading: true });
    if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
    if (refreshToken) await AuthService.signOut(refreshToken);
    await storage.clearTokens();
    set({ user: null, accessToken: null, refreshToken: null, loading: false });
  },

  signInWithGoogle: async (idToken) => {
    set({ loading: true, error: null });
    try {
      const { user, accessToken, refreshToken } = await AuthService.signInWithGoogle(idToken);
      await storage.saveTokens(accessToken, refreshToken);
      await storage.saveUser(user);
      set({ user, accessToken, refreshToken, loading: false });
      scheduleRefresh(parseJwtExpiry(accessToken), get());
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Google sign in failed", loading: false });
      throw err;
    }
  },

  signInWithApple: async () => {
    set({ loading: true, error: null });
    try {
      const { user, accessToken, refreshToken } = await AuthService.signInWithApple();
      await storage.saveTokens(accessToken, refreshToken);
      await storage.saveUser(user);
      set({ user, accessToken, refreshToken, loading: false });
      scheduleRefresh(parseJwtExpiry(accessToken), get());
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Apple sign in failed", loading: false });
      throw err;
    }
  },

  refreshSession: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return false;
    try {
      const tokens = await AuthService.refreshTokens(refreshToken);
      await storage.saveTokens(tokens.accessToken, tokens.refreshToken);
      set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      scheduleRefresh(parseJwtExpiry(tokens.accessToken), get());
      return true;
    } catch {
      await storage.clearTokens();
      set({ user: null, accessToken: null, refreshToken: null });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
