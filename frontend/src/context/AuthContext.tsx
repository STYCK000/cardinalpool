import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserMode, UserProfile } from '../types';
import { apiRequest, getAuthToken, setAuthToken } from '../services/api';
import { disconnectTrackingSocket } from '../services/socket';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchMode: (mode: UserMode) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{ user: UserProfile }>('/auth/me');
      setUser(data.user);
    } catch {
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await apiRequest<{ token: string; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    setAuthToken(null);
    disconnectTrackingSocket();
    setUser(null);
  };

  const switchMode = async (mode: UserMode) => {
    const data = await apiRequest<{ user: UserProfile }>('/users/mode', {
      method: 'PATCH',
      body: JSON.stringify({ mode }),
    });
    setUser(data.user);
  };

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, login, logout, switchMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
