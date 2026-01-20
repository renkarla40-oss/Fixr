import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useAuth } from './AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

/**
 * NOTIFICATION CONTEXT - UNREAD MESSAGE TRACKING
 * 
 * Tracks unread message counts by polling the server.
 * lastSeenMessages is persisted to AsyncStorage per user for deterministic behavior.
 */

// Storage key prefix for lastSeenMessages
const LAST_SEEN_KEY_PREFIX = 'lastSeenMessages:';

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
  const [initialized, setInitialized] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track all current message IDs for "mark all as read"
  const allCurrentMessagesRef = useRef<Record<string, string>>({});
  
  // Get storage key for current user
  const getStorageKey = useCallback(() => {
    if (!user?._id) return null;
    return `${LAST_SEEN_KEY_PREFIX}${user._id}`;
  }, [user?._id]);

  // Load lastSeenMessages from AsyncStorage on user login
  useEffect(() => {
    const loadLastSeenMessages = async () => {
      const key = getStorageKey();
      if (!key) {
        setInitialized(true);
        return;
      }
      
      try {
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log('[NotificationContext] Loaded lastSeenMessages from storage:', Object.keys(parsed).length, 'threads');
          setLastSeenMessages(parsed);
        } else {
          console.log('[NotificationContext] No stored lastSeenMessages found');
          setLastSeenMessages({});
        }
      } catch (err) {
        console.log('[NotificationContext] Error loading lastSeenMessages:', err);
        setLastSeenMessages({});
      }
      setInitialized(true);
    };
    
    if (user?._id) {
      loadLastSeenMessages();
    } else {
      setLastSeenMessages({});
      setInitialized(true);
    }
  }, [user?._id, getStorageKey]);

  // Save lastSeenMessages to AsyncStorage
  const persistLastSeenMessages = useCallback(async (messages: Record<string, string>) => {
    const key = getStorageKey();
    if (!key) return;
    
    try {
      await AsyncStorage.setItem(key, JSON.stringify(messages));
      console.log('[NotificationContext] Persisted lastSeenMessages to storage:', Object.keys(messages).length, 'threads');
    } catch (err) {
      console.log('[NotificationContext] Error persisting lastSeenMessages:', err);
    }
  }, [getStorageKey]);

  // Fetch unread message count by checking all conversations
  const refreshUnreadCount = useCallback(async () => {
    if (!token || !user || !initialized) return;
    
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
  }, [token, user, lastSeenMessages, initialized]);

  // Mark a specific thread as read
  const markThreadAsRead = useCallback(async (requestId: string) => {
    const lastMsgId = allCurrentMessagesRef.current[requestId];
    if (!lastMsgId) return;
    
    const updatedMessages = {
      ...lastSeenMessages,
      [requestId]: lastMsgId,
    };
    
    setLastSeenMessages(updatedMessages);
    await persistLastSeenMessages(updatedMessages);
  }, [lastSeenMessages, persistLastSeenMessages]);

  // Mark all as read - update lastSeenMessages to include all current messages AND persist
  const markAllAsRead = useCallback(async () => {
    console.log('[NotificationContext] markAllAsRead called');
    console.log('[NotificationContext] Current messages to mark:', Object.keys(allCurrentMessagesRef.current).length, 'threads');
    
    // Merge current messages into lastSeenMessages
    const updatedMessages = {
      ...lastSeenMessages,
      ...allCurrentMessagesRef.current,
    };
    
    // Update state
    setLastSeenMessages(updatedMessages);
    
    // Persist to AsyncStorage (CRITICAL for surviving app restart)
    await persistLastSeenMessages(updatedMessages);
    
    // Immediately set count to 0
    setUnreadCount(0);
    console.log('[NotificationContext] unreadCount set to 0, persisted to storage');
  }, [lastSeenMessages, persistLastSeenMessages]);

  // Start polling when user is logged in AND lastSeenMessages is initialized
  useEffect(() => {
    if (token && user && initialized) {
      // Initial fetch
      refreshUnreadCount();
      
      // Poll every 10 seconds for new messages
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
  }, [token, user, initialized]);

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
