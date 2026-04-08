import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

import API from '@/config/api';
const TOKEN_KEY = 'heard_session_token';
const AuthContext = createContext(null);

// Axios interceptor: always send token from localStorage as Authorization header
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    // Only check if we have a stored token or cookie
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      // No token stored, try cookie-only auth
      try {
        const res = await axios.get(`${API}/auth/me`, { withCredentials: true });
        setUser(res.data);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
      return;
    }
    try {
      const res = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(res.data);
    } catch {
      // Token might be expired, clear it
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = (userData, sessionToken) => {
    if (sessionToken) {
      localStorage.setItem(TOKEN_KEY, sessionToken);
    }
    setUser(userData);
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch { /* ignore */ }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout, login, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
