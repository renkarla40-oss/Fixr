import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

/**
 * AUTH CONTEXT - PERSISTENT LOGIN
 * 
 * Session persisted with: authToken, userId, currentRole
 * On app launch:
 * - Load stored credentials
 * - Validate session via /me
 * - If valid → set user state (welcome.tsx handles navigation)
 * - If invalid → clear stored session
 */

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const BETA_NOTICE_KEY = 'betaNoticeSeen';
const AUTH_TOKEN_KEY = 'authToken';
const USER_ID_KEY = 'userId';
const CURRENT_ROLE_KEY = 'currentRole';

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

  // On mount: load stored session and auto-validate
  useEffect(() => {
    initializeStoredSession();
  }, []);

  // Load and validate stored session on app launch
  const initializeStoredSession = async () => {
    try {
      // Session restoration enabled for all environments
      // Users stay logged in after app reopen as long as token is valid
      console.log('AuthContext: Restoring session...');
      
      const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      
      if (!storedToken) {
        // No stored token - user needs to login
        setLoading(false);
        setInitialized(true);
        return;
      }

      // Token exists - validate it via /me endpoint
      console.log('AuthContext: Found stored token, validating...');
      setToken(storedToken);

      try {
        const response = await axios.get(`${BACKEND_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
          timeout: 10000,
        });
        
        const userData = response.data;
        console.log('AuthContext: Session valid, user:', userData.email);
        
        // Session valid - set user state
        setUser(userData);
        
        // Persist latest user data
        await AsyncStorage.setItem(USER_ID_KEY, userData._id);
        await AsyncStorage.setItem(CURRENT_ROLE_KEY, userData.currentRole);
        
        // Check beta notice flag
        const userBetaKey = `${BETA_NOTICE_KEY}_${userData._id}`;
        const hasSeenNotice = await AsyncStorage.getItem(userBetaKey);
        setBetaNoticeSeenByUser(hasSeenNotice === 'true');
        
      } catch (error) {
        // Session invalid - clear stored credentials
        console.log('AuthContext: Session invalid, clearing stored credentials');
        await clearStoredSession();
      }
    } catch (error) {
      console.log('AuthContext: Error loading stored session');
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  // Clear all stored session data
  const clearStoredSession = async () => {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, USER_ID_KEY, CURRENT_ROLE_KEY]);
    setToken(null);
    setUser(null);
  };

  // Initialize auth - kept for backwards compatibility (now handled by initializeStoredSession)
  const initializeAuth = useCallback(async () => {
    if (initialized) return;
    // Session is already initialized on mount via initializeStoredSession
  }, [initialized]);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email,
        password,
      }, { timeout: 15000 });
      const { token: newToken, user: userData } = response.data;
      
      // Persist session data
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken);
      await AsyncStorage.setItem(USER_ID_KEY, userData._id);
      await AsyncStorage.setItem(CURRENT_ROLE_KEY, userData.currentRole);
      
      setToken(newToken);
      setUser(userData);
      setInitialized(true);
      
      // Check if this specific user has seen the beta notice
      const userBetaKey = `${BETA_NOTICE_KEY}_${userData._id}`;
      const hasSeenNotice = await AsyncStorage.getItem(userBetaKey);
      setBetaNoticeSeenByUser(hasSeenNotice === 'true');
      
      return userData;
    } catch (error: any) {
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
      
      // Persist session data
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken);
      await AsyncStorage.setItem(USER_ID_KEY, userData._id);
      await AsyncStorage.setItem(CURRENT_ROLE_KEY, userData.currentRole);
      
      setToken(newToken);
      setUser(userData);
      setInitialized(true);
      
      // New user has NOT seen beta notice
      setBetaNoticeSeenByUser(false);
    } catch (error: any) {
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
    // Clear all stored session data
    await clearStoredSession();
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
      // Persist the new role
      await AsyncStorage.setItem(CURRENT_ROLE_KEY, role);
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
      
      // Update stored data
      await AsyncStorage.setItem(USER_ID_KEY, userData._id);
      await AsyncStorage.setItem(CURRENT_ROLE_KEY, userData.currentRole);
      
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
