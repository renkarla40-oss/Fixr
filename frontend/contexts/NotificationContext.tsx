import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

/**
 * NOTIFICATION CONTEXT - UNREAD MESSAGE TRACKING
 * 
 * Tracks unread message counts by polling the server.
 * Push notifications are still disabled for stability.
 */

interface NotificationContextType {
  unreadCount: number;
  expoPushToken: string | null;
  notification: null;
  refreshUnreadCount: () => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markThreadAsRead: (requestId: string) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  expoPushToken: null,
  notification: null,
  refreshUnreadCount: async () => {},
  markAllAsRead: async () => {},
  markThreadAsRead: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [expoPushToken] = useState<string | null>(null);
  const [lastSeenMessages, setLastSeenMessages] = useState<Record<string, string>>({});
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track all current message IDs for "mark all as read"
  const allCurrentMessagesRef = useRef<Record<string, string>>({});

  // Fetch unread message count by checking all conversations
  const refreshUnreadCount = useCallback(async () => {
    if (!token || !user) return;
    
    try {
      // Get all requests for this user - use the unified endpoint
      const response = await axios.get(`${BACKEND_URL}/api/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const requests = response.data || [];
      let totalUnread = 0;
      const currentMessages: Record<string, string> = {};
      
      // Check each request for new messages
      for (const req of requests) {
        try {
          const msgResponse = await axios.get(
            `${BACKEND_URL}/api/service-requests/${req._id}/messages`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          const messages = msgResponse.data.messages || [];
          if (messages.length > 0) {
            const lastMsgId = messages[messages.length - 1]._id;
            currentMessages[req._id] = lastMsgId;
            const lastSeen = lastSeenMessages[req._id];
            
            // If we haven't seen this thread's last message, count as unread
            if (lastSeen !== lastMsgId) {
              // Only count messages from OTHER party as unread
              const lastMsg = messages[messages.length - 1];
              if (lastMsg.senderId !== user._id) {
                totalUnread++;
              }
            }
          }
        } catch (err) {
          // Skip errors
        }
      }
      
      // Store current messages for "mark all as read"
      allCurrentMessagesRef.current = currentMessages;
      
      setUnreadCount(totalUnread);
    } catch (err) {
      // Silent fail
    }
  }, [token, user, lastSeenMessages]);

  // Mark a specific thread as read
  const markThreadAsRead = useCallback((requestId: string) => {
    // This will be called when user opens a chat
    // For now, we'll track by storing the last message ID when they open the thread
    // The actual marking happens when user navigates to the chat
  }, []);

  // Mark all as read - update lastSeenMessages to include all current messages
  const markAllAsRead = useCallback(async () => {
    console.log('[NotificationContext] markAllAsRead called');
    console.log('[NotificationContext] Current messages to mark:', allCurrentMessagesRef.current);
    
    // Update lastSeenMessages to include all current message IDs
    // This ensures polling won't re-count these as unread
    setLastSeenMessages(prev => ({
      ...prev,
      ...allCurrentMessagesRef.current,
    }));
    
    // Immediately set count to 0
    setUnreadCount(0);
    console.log('[NotificationContext] unreadCount set to 0');
  }, []);

  // Start polling when user is logged in
  useEffect(() => {
    if (token && user) {
      // Initial fetch
      refreshUnreadCount();
      
      // Poll every 10 seconds for new messages (less aggressive than chat polling)
      pollingRef.current = setInterval(() => {
        refreshUnreadCount();
      }, 10000);
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [token, user]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        expoPushToken,
        notification: null,
        refreshUnreadCount,
        markAllAsRead,
        markThreadAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
