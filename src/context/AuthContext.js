import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

function clearAuthStorage() {
  localStorage.removeItem('onelead_token');
  localStorage.removeItem('onelead_user');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('onelead_user')) || null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('onelead_token'));
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
        localStorage.setItem('onelead_user', JSON.stringify(data));
      } catch {
        setUser(null);
        setToken(null);
        clearAuthStorage();
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [token]);

  const sendOtp = async (phone) => {
    const { data } = await api.post('/auth/send-otp', { phone });
    return data;
  };

  const verifyOtp = async (phone, otp) => {
    const { data } = await api.post('/auth/verify-otp', { phone, otp });
    localStorage.setItem('onelead_token', data.token);
    localStorage.setItem('onelead_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      if (localStorage.getItem('onelead_token')) {
        await api.post('/auth/logout');
      }
    } catch {
      // Still clear local session if the API call fails
    } finally {
      clearAuthStorage();
      setToken(null);
      setUser(null);
    }
  };

  const setUserFromProfile = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem('onelead_user', JSON.stringify(nextUser));
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      sendOtp,
      verifyOtp,
      logout,
      setUserFromProfile,
      isAuthenticated: !!user,
      hasRole: (...roles) => !!user && roles.includes(user.role),
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
