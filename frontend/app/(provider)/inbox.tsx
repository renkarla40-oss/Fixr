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
const CACHE_KEY = 'provider_inbox';

// Consistent loading/empty state copy
const COPY = {
  LOADING: 'Loading...',
  EMPTY_TITLE: 'No messages yet.',
  EMPTY_MESSAGE: 'Messages from your jobs will appear here.\nStart by accepting a job request.',
  ERROR: "Couldn't load. Tap to retry.",
};

interface Message {
  _id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  createdAt: string;
  readAt?: string;
}

interface JobWithMessages {
  requestId: string;
  service: string;
  serviceSubcategory?: string;
  customerName: string;
  status: string;
  jobTown?: string;
  lastMessage?: Message;
  hasUnread: boolean;
  messageCount: number;
}

export default function ProviderInboxScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { markAllAsRead } = useNotifications();
  
  // INSTANT NAVIGATION: Initialize with cached data
  const cachedData = getCachedData<JobWithMessages[]>(CACHE_KEY);
  const [jobsWithMessages, setJobsWithMessages] = useState<JobWithMessages[]>(cachedData || []);
  const [loading, setLoading] = useState(!cachedData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(!!cachedData);
  
  // Guard to prevent double-tap navigation
  const isNavigatingRef = useRef(false);
  
  // Performance timing
  const timingRef = useRef(createTimingTracker('Provider Inbox'));

  // Clear unread badge and fetch on focus
  useFocusEffect(
    useCallback(() => {
      // Log first render timing
      timingRef.current.logFirstRender();
      console.log('[ProviderInbox] Screen focused - calling markAllAsRead');
      markAllAsRead();
      
      // Check cooldown before refetching
      if (shouldRefetch(CACHE_KEY)) {
        fetchJobsWithMessages();
      } else if (cachedData) {
        setLoading(false);
        setInitialLoadComplete(true);
      }
    }, [markAllAsRead, token])
  );

  const fetchJobsWithMessages = useCallback(async () => {
    // SINGLE-FLIGHT: Skip if already fetching
    if (isRequestInFlight(CACHE_KEY)) {
      console.log('[FETCH] Provider Inbox skip (already in-flight)');
      return;
    }
    
    // BACKOFF: Skip if in backoff period
    if (isInBackoff(CACHE_KEY)) {
      console.log('[FETCH] Provider Inbox skip (in backoff)');
      return;
    }
    
    console.log('[NAV] Provider Inbox focused');
    console.log('[FETCH] Provider Inbox start');
    
    setRequestInFlight(CACHE_KEY, true);
    markFetchStarted(CACHE_KEY);
    
    try {
      // Fetch all provider's jobs
      const response = await api.get(`${BACKEND_URL}/api/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
        actionName: 'Load Inbox',
      });
      
      if (!response.success || !response.data) {
        if (response.error?.statusCode === 429) {
          setBackoff(CACHE_KEY, 1);
        }
        if (jobsWithMessages.length === 0) {
          setError(COPY.ERROR);
        }
        console.log(`[FETCH] Provider Inbox failed ${response.error?.statusCode || 'unknown'}`);
        return;
      }
      
      const allJobs = response.data || [];
      
      // OPTIMIZED: Use timestamps from job data instead of N+1 message fetches
      const jobsWithMsgs: JobWithMessages[] = allJobs
        .filter((job: any) => 
          job.last_message_at || ['pending', 'accepted', 'in_progress'].includes(job.status)
        )
        .map((job: any) => {
          // Check for unread using per-user timestamps
          let hasUnread = false;
          if (job.last_message_at) {
            const lastMsgTime = new Date(job.last_message_at).getTime();
            const lastReadTime = job.provider_last_read_at 
              ? new Date(job.provider_last_read_at).getTime() 
              : 0;
            hasUnread = lastMsgTime > lastReadTime;
          }
          
          return {
            requestId: job._id,
            service: job.service || 'Unknown Service',
            serviceSubcategory: job.serviceSubcategory || job.subCategory,
            customerName: job.customerName || 'Customer',
            status: job.status,
            jobTown: job.jobTown || job.location,
            lastMessage: job.lastMessagePreview ? {
              _id: 'preview',
              senderId: '',
              senderName: '',
              senderRole: 'system',
              text: job.lastMessagePreview,
              createdAt: job.last_message_at,
            } : undefined,
            hasUnread,
            messageCount: 0, // Not fetching individual messages anymore
          };
        });
      
      // Sort by most recent message (jobs without messages go to the end)
      jobsWithMsgs.sort((a: JobWithMessages, b: JobWithMessages) => {
        const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      setJobsWithMessages(jobsWithMsgs);
      setCachedData(CACHE_KEY, jobsWithMsgs);
      clearBackoff(CACHE_KEY);
      setError(null);
      
      console.log(`[FETCH] Provider Inbox success (${jobsWithMsgs.length} threads)`);
      timingRef.current.logDataLoaded();
    } catch (err: any) {
      console.log('[FETCH] Provider Inbox failed (exception)');
      if (jobsWithMessages.length === 0) {
        setError(COPY.ERROR);
      }
    } finally {
      setRequestInFlight(CACHE_KEY, false);
      setLoading(false);
      setRefreshing(false);
      setInitialLoadComplete(true);
    }
  }, [token, jobsWithMessages.length]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobsWithMessages();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleJobPress = (requestId: string) => {
    // Prevent double-tap: if already navigating, ignore
    if (isNavigatingRef.current) return;
    
    isNavigatingRef.current = true;
    
    router.push({ pathname: '/provider-chat', params: { requestId } });
    
    // Reset after 800ms to allow future taps
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 800);
  };

  const renderJobItem = ({ item }: { item: JobWithMessages }) => (
    <TouchableOpacity
      style={[styles.jobItem, item.hasUnread && styles.jobItemUnread]}
      onPress={() => handleJobPress(item.requestId)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={styles.avatar}>
        <Ionicons name="person" size={24} color="#666" />
      </View>
      
      {/* Content */}
      <View style={styles.jobContent}>
        {/* Header: Name + Time */}
        <View style={styles.jobHeader}>
          <Text style={[styles.customerName, item.hasUnread && styles.textBold]} numberOfLines={1}>
            {item.customerName}
          </Text>
          {item.lastMessage && (
            <Text style={styles.timestamp}>{formatTime(item.lastMessage.createdAt)}</Text>
          )}
        </View>
        
        {/* Service */}
        <Text style={styles.serviceName} numberOfLines={1}>
          {item.service}{item.serviceSubcategory ? ` • ${item.serviceSubcategory}` : ''}
        </Text>
        
        {/* Last Message Preview */}
        {item.lastMessage ? (
          <Text style={[styles.lastMessage, item.hasUnread && styles.textBold]} numberOfLines={1}>
            {item.lastMessage.senderRole === 'provider' ? 'You: ' : ''}
            {item.lastMessage.text}
          </Text>
        ) : (
          <Text style={styles.noMessageText}>No messages yet</Text>
        )}
      </View>
      
      {/* Unread Badge */}
      {item.hasUnread && (
        <View style={styles.unreadBadge}>
          <View style={styles.unreadDot} />
        </View>
      )}
      
      <Ionicons name="chevron-forward" size={20} color="#CCC" />
    </TouchableOpacity>
  );

  // CRITICAL: Only show loading spinner on initial load (no data yet)
  // This prevents "empty flash" during rapid tab switching
  if (loading && !initialLoadComplete && jobsWithMessages.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Inbox</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#D74826" />
          <Text style={styles.loadingText}>{COPY.LOADING}</Text>
        </View>
      </View>
    );
  }

  // Error state with retry button (only if no data)
  if (error && jobsWithMessages.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Inbox</Text>
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="cloud-offline-outline" size={48} color="#999" />
          <Text style={styles.errorText}>{COPY.ERROR}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchJobsWithMessages}>
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
        {jobsWithMessages.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{jobsWithMessages.length}</Text>
          </View>
        )}
      </View>
      
      {/* Debug Banner - Disabled in production. Only enable via explicit flag for debugging */}
      {/* {__DEV__ && process.env.EXPO_PUBLIC_SHOW_DEBUG === 'true' && renderDebugBanner()} */}
      
      {/* Empty state - ONLY show when initial load is complete AND truly empty */}
      {initialLoadComplete && jobsWithMessages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>{COPY.EMPTY_TITLE}</Text>
          <Text style={styles.emptyText}>{COPY.EMPTY_MESSAGE}</Text>
        </View>
      ) : (
        <FlatList
          data={jobsWithMessages}
          renderItem={renderJobItem}
          keyExtractor={(item) => item.requestId}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D74826" />
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
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#F8F9FA',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  countText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#D74826',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  jobItem: {
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
  jobItemUnread: {
    backgroundColor: '#FFF8F8',
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
  jobContent: {
    flex: 1,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
  },
  textBold: {
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  serviceName: {
    fontSize: 13,
    color: '#D74826',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  unreadBadge: {
    marginRight: 8,
    justifyContent: 'center',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D74826',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 78,
  },
  noMessageText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
});
