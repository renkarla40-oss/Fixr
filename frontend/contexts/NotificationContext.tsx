import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useAuth } from './AuthContext';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Configure notification behavior
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

  // Register for push notifications
  const registerForPushNotifications = useCallback(async () => {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Get the push token
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-project-id', // This is fine for development
      });
      return tokenData.data;
    } catch (error) {
      console.log('Error getting push token:', error);
      return null;
    }
  }, []);

  // Register push token with backend
  const registerTokenWithBackend = useCallback(async (pushToken: string) => {
    if (!token) return;
    
    try {
      await axios.post(
        `${BACKEND_URL}/api/notifications/register-token`,
        { expoPushToken: pushToken },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('Push token registered with backend');
    } catch (error) {
      console.log('Error registering push token:', error);
    }
  }, [token]);

  // Fetch unread notification count
  const refreshUnreadCount = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.log('Error fetching unread count:', error);
    }
  }, [token]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!token) return;
    
    try {
      await axios.patch(
        `${BACKEND_URL}/api/notifications/read-all`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUnreadCount(0);
    } catch (error) {
      console.log('Error marking notifications as read:', error);
    }
  }, [token]);

  // Setup push notifications when user logs in
  useEffect(() => {
    if (!user || !token) return;

    // Register for push notifications
    registerForPushNotifications().then((pushToken) => {
      if (pushToken) {
        setExpoPushToken(pushToken);
        registerTokenWithBackend(pushToken);
      }
    });

    // Setup notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
      // Refresh unread count when notification received
      refreshUnreadCount();
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      // Handle notification tap - could navigate to relevant screen
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);
      // Navigation would be handled here based on data.type and data.requestId
    });

    // Setup Android notification channel
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // Initial fetch of unread count
    refreshUnreadCount();

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [user, token, registerForPushNotifications, registerTokenWithBackend, refreshUnreadCount]);

  // Refresh unread count when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
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
