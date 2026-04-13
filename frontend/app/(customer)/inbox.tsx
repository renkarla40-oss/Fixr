import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { getServiceLabel } from '../../constants/serviceCategories';
import { COLORS } from '../../constants/colors';
import { api } from '../../utils/apiClient';
import {
  getCachedData,
  setCachedData,
  shouldRefetch,
  markFetchStarted,
  isRequestInFlight,
  setRequestInFlight,
  isInBackoff,
  setBackoff,
  clearBackoff,
  createTimingTracker,
} from '../../utils/screenCache';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const CACHE_KEY = 'customer_inbox';

// Consistent loading/empty state copy
const COPY = {
  LOADING: 'Loading...',
  EMPTY_TITLE: 'No messages yet.',
  EMPTY_MESSAGE: 'Your messages with service providers will appear here.',
  ERROR: "Couldn't load. Tap to retry.",
};

interface Conversation {
  requestId: string;
  service: string;
  providerName: string;
  status: string;
  lastMessage?: {
    text: string;
    senderRole: string;
    createdAt: string;
  };
  unreadCount: number;
}

export default function CustomerInboxScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const { markAllAsRead } = useNotifications();
  
  // INSTANT NAVIGATION: Initialize with cached data
  const cachedData = getCachedData<Conversation[]>(CACHE_KEY);
  const [conversations, setConversations] = useState<Conversation[]>(cachedData || []);
  const [loading, setLoading] = useState(!cachedData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(!!cachedData);

  // Guard to prevent double-tap navigation
  const isNavigatingRef = useRef(false);
  
  // Performance timing
  const timingRef = useRef(createTimingTracker('Customer Inbox'));

  const handleConversationPress = (requestId: string) => {
    // Prevent double-tap: if already navigating, ignore
    if (isNavigatingRef.current) return;
    
    isNavigatingRef.current = true;
    
    router.push({ pathname: '/customer-chat', params: { requestId } });
    
    // Reset after 1000ms to allow future taps
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 1000);
  };

  // Clear unread badge when Inbox screen is focused
  useFocusEffect(
    useCallback(() => {
      // Log first render timing
      timingRef.current.logFirstRender();
      markAllAsRead();
      
      // Check cooldown before refetching
      if (shouldRefetch(CACHE_KEY)) {
        fetchConversations();
      } else if (cachedData) {
        setLoading(false);
        setInitialLoadComplete(true);
      }
    }, [markAllAsRead, token])
  );

  const fetchConversations = useCallback(async () => {
    // SINGLE-FLIGHT: Skip if already fetching
    if (isRequestInFlight(CACHE_KEY)) {
      console.log('[FETCH] Customer Inbox skip (already in-flight)');
      return;
    }
    
    // BACKOFF: Skip if in backoff period
    if (isInBackoff(CACHE_KEY)) {
      console.log('[FETCH] Customer Inbox skip (in backoff)');
      return;
    }
    
    console.log('[NAV] Customer Inbox focused');
    console.log('[FETCH] Customer Inbox start');
    
    setRequestInFlight(CACHE_KEY, true);
    markFetchStarted(CACHE_KEY);
    
    try {
      // Fetch all customer requests
      const response = await api.get(`${BACKEND_URL}/api/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
        actionName: 'Load Inbox',
      });
      
      if (!response.success || !response.data) {
        if (response.error?.statusCode === 429) {
          setBackoff(CACHE_KEY, 1);
        }
        if (conversations.length === 0) {
          setError(COPY.ERROR);
        }
        console.log(`[FETCH] Customer Inbox failed ${response.error?.statusCode || 'unknown'}`);
        return;
      }
      
      const requests = response.data || [];
      
      // OPTIMIZED: Use timestamps from request data instead of N+1 message fetches
      const conversationsWithMessages: Conversation[] = requests
        .filter((req: any) => 
          req.last_message_at || ['pending', 'accepted', 'in_progress', 'completed'].includes(req.status)
        )
        .map((req: any) => {
          // Per-user unread tracking using timestamps
          let unread = 0;
          if (req.last_message_at) {
            const lastMsgTime = new Date(req.last_message_at).getTime();
            const lastReadTime = req.customer_last_read_at 
              ? new Date(req.customer_last_read_at).getTime() 
              : 0;
            if (lastMsgTime > lastReadTime) {
              unread = 1;
            }
          }
          
          return {
            requestId: req._id,
            service: req.service,
            providerName: req.providerName || 'Open Request',
            status: req.status,
            lastMessage: req.lastMessagePreview ? {
              text: req.lastMessagePreview,
              senderRole: 'system',
              createdAt: req.last_message_at,
            } : undefined,
            unreadCount: unread,
          };
        });
      
      // Sort by most recent activity
      conversationsWithMessages.sort((a: Conversation, b: Conversation) => {
        const dateA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const dateB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      setConversations(conversationsWithMessages);
      setCachedData(CACHE_KEY, conversationsWithMessages);
      clearBackoff(CACHE_KEY);
      setError(null);
      
      console.log(`[FETCH] Customer Inbox success (${conversationsWithMessages.length} threads)`);
      timingRef.current.logDataLoaded();
    } catch (err) {
      console.log('[FETCH] Customer Inbox failed (exception)');
      if (conversations.length === 0) {
        setError(COPY.ERROR);
      }
    } finally {
      setRequestInFlight(CACHE_KEY, false);
      setLoading(false);
      setRefreshing(false);
      setInitialLoadComplete(true);
    }
  }, [token, conversations.length]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return '#4CAF50';
      case 'in_progress': return '#2196F3';
      case 'completed': return '#9C27B0';
      case 'declined': return '#F44336';
      default: return '#4A7DC4';
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => handleConversationPress(item.requestId)}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Ionicons name="person" size={24} color="#666" />
      </View>
      
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.providerName} numberOfLines={1}>{item.providerName}</Text>
          {item.lastMessage && (
            <Text style={styles.timestamp}>{formatTime(item.lastMessage.createdAt)}</Text>
          )}
        </View>
        
        <Text style={styles.serviceName} numberOfLines={1}>
          {getServiceLabel(item.service)}
        </Text>
        
        {item.lastMessage ? (
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage.senderRole === 'customer' ? 'You: ' : ''}
            {item.lastMessage.text}
          </Text>
        ) : (
          <Text style={styles.noMessages}>No messages yet</Text>
        )}
      </View>
      
      <View style={styles.statusIndicator}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
      </View>
      
      <Ionicons name="chevron-forward" size={20} color="#CCC" />
    </TouchableOpacity>
  );

  // CRITICAL: Only show loading spinner on initial load (no data yet)
  // This prevents "empty flash" during rapid tab switching
  if (loading && !initialLoadComplete && conversations.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Inbox</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#1E4DB7" />
          <Text style={styles.loadingText}>{COPY.LOADING}</Text>
        </View>
      </View>
    );
  }

  // Error state with retry button (only if no data)
  if (error && conversations.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Inbox</Text>
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="cloud-offline-outline" size={48} color="#999" />
          <Text style={styles.errorText}>{COPY.ERROR}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchConversations}>
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
      </View>
      
      {/* Empty state - ONLY show when initial load is complete AND truly empty */}
      {initialLoadComplete && conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>{COPY.EMPTY_TITLE}</Text>
          <Text style={styles.emptyText}>{COPY.EMPTY_MESSAGE}</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.requestId}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1D4F91',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#1E4DB7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  retryButtonText: {
    color: '#1D4F91',
    fontSize: 14,
    fontWeight: '700',
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  serviceName: {
    fontSize: 13,
    color: '#1E4DB7',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  noMessages: {
    fontSize: 14,
    fontWeight: '700',
    color: '#999',
    fontStyle: 'italic',
  },
  statusIndicator: {
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  separator: {
    height: 0,
  },
});
