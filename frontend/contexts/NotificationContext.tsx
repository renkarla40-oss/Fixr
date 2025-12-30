import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Configure notification behavior - SILENT, no alerts for errors
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface NotificationContextType {
  unreadCount: number;
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  refreshUnreadCount: () => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  expoPushToken: null,
  notification: null,
  refreshUnreadCount: async () => {},
  markAllAsRead: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();
  const appState = useRef(AppState.currentState);

  // Register for push notifications - COMPLETELY SILENT, never shows errors
  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    try {
      // CRITICAL: Only attempt on physical devices
      if (!Device.isDevice) {
        // Simulator/emulator - skip silently
        return null;
      }

      // Check if we're in Expo Go (limited push support)
      const isExpoGo = Constants.appOwnership === 'expo';
      
      // Check platform support
      if (Platform.OS === 'android') {
        // Setup Android channel silently
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
          });
        } catch {
          // Channel setup failed - continue silently
        }
      }

      // Check existing permissions silently
      let permissionStatus;
      try {
        const { status } = await Notifications.getPermissionsAsync();
        permissionStatus = status;
      } catch {
        // Permission check failed - skip push
        return null;
      }

      // Request permission if not granted (only once, silently)
      if (permissionStatus !== 'granted') {
        try {
          const { status } = await Notifications.requestPermissionsAsync();
          permissionStatus = status;
        } catch {
          // Permission request failed - skip push silently
          return null;
        }
      }

      // If still not granted, skip silently
      if (permissionStatus !== 'granted') {
        return null;
      }

      // Try to get push token - this can fail in Expo Go
      try {
        // For Expo Go, we need projectId from app config
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        
        // Wrap in additional try-catch to suppress expo-notifications native errors
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId || undefined,
        }).catch(() => null);
        
        return tokenData?.data || null;
      } catch {
        // Token retrieval failed (common in Expo Go) - skip silently
        return null;
      }
    } catch {
      // Any unexpected error - fail silently
      return null;
    }
  }, []);

  // Register push token with backend - silent
  const registerTokenWithBackend = useCallback(async (pushToken: string) => {
    if (!token || !pushToken) return;
    
    try {
      await axios.post(
        `${BACKEND_URL}/api/notifications/register-token`,
        { expoPushToken: pushToken },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      // Registration failed - silent, in-app notifications still work
    }
  }, [token]);

  // Fetch unread notification count - silent errors
  const refreshUnreadCount = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnreadCount(response.data.unreadCount || 0);
    } catch {
      // Error fetching count - keep current value
    }
  }, [token]);

  // Mark all notifications as read - silent errors
  const markAllAsRead = useCallback(async () => {
    if (!token) return;
    
    try {
      await axios.patch(
        `${BACKEND_URL}/api/notifications/read-all`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUnreadCount(0);
    } catch {
      // Error marking as read - silent
    }
  }, [token]);

  // Setup push notifications when user logs in
  useEffect(() => {
    if (!user || !token) return;

    // Register for push notifications (silent)
    registerForPushNotifications().then((pushToken) => {
      if (pushToken) {
        setExpoPushToken(pushToken);
        registerTokenWithBackend(pushToken);
      }
    });

    // Setup notification listeners (safe)
    try {
      notificationListener.current = Notifications.addNotificationReceivedListener((notif) => {
        setNotification(notif);
        refreshUnreadCount();
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        // Handle notification tap silently
        const data = response.notification.request.content.data;
        // Navigation could be handled here based on data.type
      });
    } catch {
      // Listener setup failed - silent
    }

    // Initial fetch of unread count
    refreshUnreadCount();

    return () => {
      try {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      } catch {
        // Cleanup failed - silent
      }
    };
  }, [user, token, registerForPushNotifications, registerTokenWithBackend, refreshUnreadCount]);

  // Refresh unread count when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        refreshUnreadCount();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [refreshUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        expoPushToken,
        notification,
        refreshUnreadCount,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
