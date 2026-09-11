'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem('mm_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    // Verify token is still valid
    api.get('/api/auth/me')
      .then((res) => {
        setUser(res.data.user);
        localStorage.setItem('mm_user', JSON.stringify(res.data.user));
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('mm_user');
        localStorage.removeItem('mm_token');
        localStorage.removeItem('mm_refresh_token');
        if (pathname !== '/login') router.push('/login');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password });
    const { user: u, token, refreshToken } = res.data;
    setUser(u);
    localStorage.setItem('mm_user', JSON.stringify(u));
    localStorage.setItem('mm_token', token);
    if (refreshToken) {
      localStorage.setItem('mm_refresh_token', refreshToken);
    }
    router.push('/dashboard');
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout'); } catch { /* ignore */ }
    setUser(null);
    localStorage.removeItem('mm_user');
    localStorage.removeItem('mm_token');
    localStorage.removeItem('mm_refresh_token');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
