import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';

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
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, phone: string, role: 'customer' | 'provider') => Promise<void>;
  loginWithToken: (token: string, userData: any) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: 'customer' | 'provider') => Promise<void>;
  refreshUser: () => Promise<void>;
  markBetaNoticeSeen: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [betaNoticeSeenByUser, setBetaNoticeSeenByUser] = useState<boolean | null>(null);

  // Computed property: show beta notice only when user is a beta user AND hasn't seen it
  const shouldShowBetaNotice = user !== null && user.isBetaUser && betaNoticeSeenByUser === false;

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      
      if (storedToken) {
        setToken(storedToken);
        await fetchUserAndCheckBeta(storedToken);
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserAndCheckBeta = async (authToken: string) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const userData = response.data;
      setUser(userData);
      
      // Check user-specific beta notice flag
      const userBetaKey = `${BETA_NOTICE_KEY}_${userData._id}`;
      const hasSeenNotice = await AsyncStorage.getItem(userBetaKey);
      setBetaNoticeSeenByUser(hasSeenNotice === 'true');
    } catch (error) {
      console.error('Error fetching user:', error);
      await logout();
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email,
        password,
      });
      const { token: newToken, user: userData } = response.data;
      
      await AsyncStorage.setItem('authToken', newToken);
      setToken(newToken);
      setUser(userData);
      
      // Check if this specific user has seen the beta notice
      const userBetaKey = `${BETA_NOTICE_KEY}_${userData._id}`;
      const hasSeenNotice = await AsyncStorage.getItem(userBetaKey);
      setBetaNoticeSeenByUser(hasSeenNotice === 'true');
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Login failed');
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
      });
      const { token: newToken, user: userData } = response.data;
      
      await AsyncStorage.setItem('authToken', newToken);
      setToken(newToken);
      setUser(userData);
      
      // New user has NOT seen beta notice
      setBetaNoticeSeenByUser(false);
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Signup failed');
    }
  };

  const loginWithToken = async (newToken: string, userData: any) => {
    try {
      await AsyncStorage.setItem('authToken', newToken);
      setToken(newToken);
      setUser(userData);
      
      // Check if beta notice was seen for this user
      const betaNoticeSeen = await AsyncStorage.getItem(`${BETA_NOTICE_KEY}_${userData._id}`);
      setBetaNoticeSeenByUser(betaNoticeSeen === 'true');
    } catch (error: any) {
      throw new Error('Failed to set authentication');
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
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUser(response.data);
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to switch role');
    }
  };

  const refreshUser = async () => {
    if (token) {
      await fetchUserAndCheckBeta(token);
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
        loginWithToken,
        logout, 
        switchRole, 
        refreshUser,
        markBetaNoticeSeen,
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