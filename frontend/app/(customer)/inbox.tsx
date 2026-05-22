import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
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
          req.providerPhoto &&
          (req.last_message_at || ['pending', 'accepted', 'in_progress', 'completed'].includes(req.status))
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
            profilePhotoUrl: req.providerPhoto || req.providerPhotoUrl || req.profilePhotoUrl,
            lastMessage: req.last_message_at ? {
              text: req.lastMessage || 'Tap to view messages',
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
      case 'in_progress': return '#F05A28';
      case 'completed': return '#9C27B0';
      case 'declined': return '#F44336';
      default: return '#F05A28';
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => handleConversationPress(item.requestId)}
      activeOpacity={0.7}
    >
      {item.profilePhotoUrl ? (
      <Image
        source={{
          uri: item.profilePhotoUrl.startsWith('/')
            ? `${BACKEND_URL}${item.profilePhotoUrl}`
            : item.profilePhotoUrl,
        }}
        style={styles.avatar}
      />
    ) : (
      <View style={styles.avatar}>
        <Ionicons name="person" size={24} color="#666" />
      </View>
    )}
      
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
          <Text style={styles.noMessages}>Tap to view messages</Text>
        )}
      </View>
      
      {item.unreadCount > 0 && item.lastMessage?.text !== 'Tap to view messages' && (
        <View style={styles.statusIndicator}>
          <View style={styles.statusDot} />
        </View>
      )}
      
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  // CRITICAL: Only show loading spinner on initial load (no data yet)
  // This prevents "empty flash" during rapid tab switching
  // Error state with retry button (only if no data)
  if (error && conversations.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerShell, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Inbox</Text>
          </View>
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
    <View style={styles.container}>
      <View style={[styles.headerShell, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Inbox</Text>
        </View>
      </View>
      
      {/* Lightweight placeholder while first inbox fetch completes */}
      {!initialLoadComplete && conversations.length === 0 ? (
        <View style={styles.listContent}>
          {[1, 2, 3].map((item) => (
            <View key={item} style={styles.skeletonConversationItem}>
              <View style={styles.skeletonAvatar} />
              <View style={styles.skeletonTextBlock}>
                <View style={styles.skeletonLineWide} />
                <View style={styles.skeletonLineShort} />
              </View>
            </View>
          ))}
        </View>
      ) : initialLoadComplete && conversations.length === 0 ? (
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
  headerShell: {
    backgroundColor: '#E4ECF4',
  },
  container: {
    flex: 1,
    backgroundColor: '#E4ECF4',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#2B3642',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#666',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#F05A28',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  retryButtonText: {
    color: '#666',
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
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    paddingTop: 18,
    paddingBottom: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  skeletonConversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    minHeight: 76,
    opacity: 0.75,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF3F8',
    marginRight: 12,
  },
  skeletonTextBlock: {
    flex: 1,
    gap: 8,
  },
  skeletonLineWide: {
    height: 12,
    width: '72%',
    borderRadius: 8,
    backgroundColor: '#EEF3F8',
  },
  skeletonLineShort: {
    height: 10,
    width: '45%',
    borderRadius: 8,
    backgroundColor: '#EEF3F8',
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
    overflow: 'hidden',
    backgroundColor: '#EEF3F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
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
    color: '#666',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#8A8F98',
    fontStyle: 'italic',
    fontWeight: '700',
  },
  noMessages: {
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: '#C13E1F',
  },
  separator: {
    height: 0,
  },
});
