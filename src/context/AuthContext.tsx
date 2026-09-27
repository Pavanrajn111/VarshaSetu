import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { SupportedLanguage, UserProfile } from '@/lib/types';
import { apiClient, TOKEN_STORAGE_KEY, ApiError } from '@/lib/api-client';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  login: (phone: string, password: string) => Promise<void>;
  register: (payload: {
    full_name: string;
    phone_number: string;
    password: string;
    preferred_language: SupportedLanguage;
    role?: 'farmer' | 'officer';
    default_taluk?: string;
    default_district?: string;
  }) => Promise<void>;
  logout: () => void;
  updatePreferences: (updates: {
    preferred_language?: SupportedLanguage;
    default_taluk?: string;
    default_district?: string;
    notification_prefs?: Record<string, any>;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  // Restore session from localStorage on initial load
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
      if (!storedToken) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const res = await apiClient.getMe();
        if (isMounted && res.user) {
          setUser(res.user);
          setToken(storedToken);
        }
      } catch (err) {
        console.warn('[Varsha Setu] Stored token invalid or expired. Clearing session.');
        if (typeof window !== 'undefined') {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    setAuthError(null);
    try {
      const res = await apiClient.login({ phone_number: phone, password });
      if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
      }
      setToken(res.token);
      setUser(res.user);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Invalid phone number or password.';
      setAuthError(msg);
      throw err;
    }
  }, []);

  const register = useCallback(
    async (payload: {
      full_name: string;
      phone_number: string;
      password: string;
      preferred_language: SupportedLanguage;
      role?: 'farmer' | 'officer';
      default_taluk?: string;
      default_district?: string;
    }) => {
      setAuthError(null);
      try {
        const res = await apiClient.register(payload);
        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
        }
        setToken(res.token);
        setUser(res.user);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Failed to register account.';
        setAuthError(msg);
        throw err;
      }
    },
    []
  );

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    setUser(null);
    setToken(null);
    setAuthError(null);
  }, []);

  const updatePreferences = useCallback(
    async (updates: {
      preferred_language?: SupportedLanguage;
      default_taluk?: string;
      default_district?: string;
      notification_prefs?: Record<string, any>;
    }) => {
      try {
        const res = await apiClient.updateMe(updates);
        if (res.user) {
          setUser(res.user);
        }
      } catch (err) {
        console.error('[Varsha Setu] Failed to update preferences:', err);
        throw err;
      }
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        authError,
        clearAuthError,
        login,
        register,
        logout,
        updatePreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
