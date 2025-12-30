import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * NOTIFICATION CONTEXT - DISABLED
 * 
 * Push notifications and automatic API calls are DISABLED until further notice.
 * This is a stability fix to prevent any errors from appearing at app boot.
 * 
 * NO:
 * - Push notification registration
 * - Automatic axios calls on mount
 * - expo-notifications imports that execute code
 * - Any API calls at boot
 * 
 * This context now only provides stub functions that do nothing.
 */

interface NotificationContextType {
  unreadCount: number;
  expoPushToken: string | null;
  notification: null;
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
  // Static state - no automatic updates
  const [unreadCount] = useState(0);
  const [expoPushToken] = useState<string | null>(null);

  // Stub functions - do nothing
  const refreshUnreadCount = useCallback(async () => {
    // DISABLED - no automatic API calls
  }, []);

  const markAllAsRead = useCallback(async () => {
    // DISABLED - no automatic API calls
  }, []);

  // NO useEffect hooks that call APIs
  // NO push notification registration
  // NO expo-notifications imports

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        expoPushToken,
        notification: null,
        refreshUnreadCount,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
