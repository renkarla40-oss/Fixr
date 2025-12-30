import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

/**
 * AUTH CONTEXT - STABILITY FIX
 * 
 * NO automatic axios calls on mount.
 * NO side effects at app boot.
 * 
 * API calls only happen:
 * - On explicit login/signup
 * - On explicit refreshUser call
 * - AFTER user interaction
 */

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const BETA_NOTICE_KEY = 'betaNoticeSeen';

interface User {
  _id: string;
  email: string;
  name: string;
  phone: string;
  currentRole: 'customer' | 'provider';
  isProviderEnabled: boolean;
  isBetaUser: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  shouldShowBetaNotice: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string, name: string, phone: string, role: 'customer' | 'provider') => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: 'customer' | 'provider') => Promise<void>;
  refreshUser: () => Promise<void>;
  markBetaNoticeSeen: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [betaNoticeSeenByUser, setBetaNoticeSeenByUser] = useState<boolean | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Computed property: show beta notice only when user is a beta user AND hasn't seen it
  const shouldShowBetaNotice = user !== null && user.isBetaUser && betaNoticeSeenByUser === false;

  // Load stored token from AsyncStorage (LOCAL ONLY - no network)
  useEffect(() => {
    loadStoredToken();
  }, []);

  // Load token from storage WITHOUT making API calls
  const loadStoredToken = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      if (storedToken) {
        setToken(storedToken);
      }
    } catch {
      // Silent fail - local storage error
    } finally {
      setLoading(false);
    }
  };

  // Initialize auth - called AFTER splash/welcome transition
  // This is the ONLY place where we make the initial API call
  const initializeAuth = useCallback(async () => {
    if (initialized) return;
    
    const storedToken = token || await AsyncStorage.getItem('authToken');
    if (!storedToken) {
      setInitialized(true);
      return;
    }

    try {
      const response = await axios.get(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
        timeout: 10000, // 10 second timeout
      });
      const userData = response.data;
      setUser(userData);
      setToken(storedToken);
      
      // Check user-specific beta notice flag
      const userBetaKey = `${BETA_NOTICE_KEY}_${userData._id}`;
      const hasSeenNotice = await AsyncStorage.getItem(userBetaKey);
      setBetaNoticeSeenByUser(hasSeenNotice === 'true');
    } catch {
      // Silent fail - network error or invalid token
      // Clear invalid token
      await AsyncStorage.removeItem('authToken');
      setToken(null);
      setUser(null);
    } finally {
      setInitialized(true);
    }
  }, [token, initialized]);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email,
        password,
      }, { timeout: 15000 });
      const { token: newToken, user: userData } = response.data;
      
      await AsyncStorage.setItem('authToken', newToken);
      setToken(newToken);
      setUser(userData);
      setInitialized(true);
      
      // Check if this specific user has seen the beta notice
      const userBetaKey = `${BETA_NOTICE_KEY}_${userData._id}`;
      const hasSeenNotice = await AsyncStorage.getItem(userBetaKey);
      setBetaNoticeSeenByUser(hasSeenNotice === 'true');
      
      return userData;
    } catch (error: any) {
      // Return user-friendly error message - NEVER expose technical details
      const detail = error.response?.data?.detail;
      if (detail && typeof detail === 'string' && detail.includes('Invalid')) {
        throw new Error('Invalid email or password');
      }
      throw new Error('Unable to sign in. Please try again.');
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    phone: string,
    role: 'customer' | 'provider'
  ) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/signup`, {
        email,
        password,
        name,
        phone,
        currentRole: role,
      }, { timeout: 15000 });
      const { token: newToken, user: userData } = response.data;
      
      await AsyncStorage.setItem('authToken', newToken);
      setToken(newToken);
      setUser(userData);
      setInitialized(true);
      
      // New user has NOT seen beta notice
      setBetaNoticeSeenByUser(false);
    } catch (error: any) {
      // Return user-friendly error message - NEVER expose technical details
      const detail = error.response?.data?.detail;
      if (detail && typeof detail === 'string' && detail.includes('already exists')) {
        throw new Error('An account with this email already exists');
      }
      throw new Error('Unable to create account. Please try again.');
    }
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    setBetaNoticeSeenByUser(null);
    await AsyncStorage.removeItem('authToken');
  };

  const switchRole = async (role: 'customer' | 'provider') => {
    if (!token) return;
    try {
      const response = await axios.patch(
        `${BACKEND_URL}/api/users/role`,
        { currentRole: role },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
      );
      setUser(response.data);
    } catch {
      throw new Error('Unable to switch mode. Please try again.');
    }
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      const userData = response.data;
      setUser(userData);
      
      const userBetaKey = `${BETA_NOTICE_KEY}_${userData._id}`;
      const hasSeenNotice = await AsyncStorage.getItem(userBetaKey);
      setBetaNoticeSeenByUser(hasSeenNotice === 'true');
    } catch {
      // Silent fail - don't disrupt user
    }
  };

  const markBetaNoticeSeen = async () => {
    if (user) {
      const userBetaKey = `${BETA_NOTICE_KEY}_${user._id}`;
      await AsyncStorage.setItem(userBetaKey, 'true');
      setBetaNoticeSeenByUser(true);
    }
  };

  return (
    <AuthContext.Provider
      value={{ 
        user, 
        token, 
        loading, 
        shouldShowBetaNotice,
        login, 
        signup, 
        logout, 
        switchRole, 
        refreshUser,
        markBetaNoticeSeen,
        initializeAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
