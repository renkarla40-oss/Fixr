import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Consistent copy
const COPY = {
  LOADING: 'Loading...',
  EMPTY_TITLE: 'No notifications yet',
  EMPTY_MESSAGE: "You'll see updates about your jobs and messages here",
  ERROR: "Couldn't load. Tap to retry.",
};

interface ActivityItem {
  _id: string;
  requestId: string;
  type: 'message' | 'status_change';
  title: string;
  body: string;
  isUnread: boolean;
  timestamp: string;
  status?: string;
  serviceType?: string;
  otherPartyName?: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { unreadCount, markAllAsRead, markThreadAsRead } = useNotifications();
  const insets = useSafeAreaInsets();
  
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const fetchCounterRef = useRef(0);

  // Fetch activities from the same source as the bell badge (service requests + messages)
  const fetchActivities = useCallback(async () => {
    if (!token || !user) return;
    
    const currentFetch = ++fetchCounterRef.current;
    setError(null);
    
    try {
      // Get all service requests (same as NotificationContext)
      const response = await axios.get(`${BACKEND_URL}/api/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const requests = response.data || [];
      const activityItems: ActivityItem[] = [];
      
      // Process each request to extract activity items
      for (const req of requests) {
        try {
          // Fetch messages for this request
          const msgResponse = await axios.get(
            `${BACKEND_URL}/api/service-requests/${req._id}/messages`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          const messages = msgResponse.data.messages || [];
          if (messages.length === 0) continue;
          
          // Get the last message
          const lastMsg = messages[messages.length - 1];
          const isFromOther = lastMsg.senderId !== user._id;
          
          // Determine the "other party" name
          const isCustomer = user.role === 'customer' || !user.isProviderEnabled;
          const otherPartyName = isCustomer 
            ? (req.providerName || req.provider?.name || 'Provider')
            : (req.customerName || req.customer?.name || 'Customer');
          
          // Check unread status based on timestamps (same logic as backend)
          const lastReadField = isCustomer ? 'customer_last_read_at' : 'provider_last_read_at';
          const lastReadAt = req[lastReadField] ? new Date(req[lastReadField]) : null;
          const lastMessageAt = req.last_message_at ? new Date(req.last_message_at) : null;
          const isUnread = isFromOther && lastMessageAt && (!lastReadAt || lastMessageAt > lastReadAt);
          
          // Create activity item from the latest message/update
          const activity: ActivityItem = {
            _id: `${req._id}-${lastMsg._id}`,
            requestId: req._id,
            type: lastMsg.isSystemMessage ? 'status_change' : 'message',
            title: getActivityTitle(lastMsg, req, isCustomer, otherPartyName),
            body: getActivityBody(lastMsg, req),
            isUnread: !!isUnread,
            timestamp: lastMsg.createdAt || lastMsg.timestamp,
            status: req.status,
            serviceType: req.serviceType,
            otherPartyName,
          };
          
          activityItems.push(activity);
        } catch (err) {
          // Skip failed requests silently
        }
      }
      
      // Stale response guard
      if (currentFetch !== fetchCounterRef.current) return;
      
      // Sort by timestamp (newest first)
      activityItems.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      setActivities(activityItems);
    } catch (err) {
      if (currentFetch !== fetchCounterRef.current) return;
      if (activities.length === 0) {
        setError(COPY.ERROR);
      }
      console.warn('[Notifications] Error fetching activities:', err);
    } finally {
      if (currentFetch === fetchCounterRef.current) {
        setLoading(false);
        setRefreshing(false);
        setInitialLoadComplete(true);
      }
    }
  }, [token, user]);

  // Get title for activity based on message type
  const getActivityTitle = (
    msg: any, 
    req: any, 
    isCustomer: boolean, 
    otherPartyName: string
  ): string => {
    if (msg.isSystemMessage) {
      // Parse system message to determine type
      const text = (msg.text || msg.content || '').toLowerCase();
      if (text.includes('accepted')) return 'Request Accepted';
      if (text.includes('declined')) return 'Request Declined';
      if (text.includes('started')) return 'Job Started';
      if (text.includes('completed')) return 'Job Completed';
      if (text.includes('cancelled') || text.includes('canceled')) return 'Job Cancelled';
      if (text.includes('review')) return 'Review Received';
      if (text.includes('quote')) return 'Quote Received';
      if (text.includes('timeout') || text.includes('didn\'t respond')) return 'Provider Timeout';
      return 'Job Update';
    }
    return `Message from ${otherPartyName}`;
  };

  // Get body text for activity
  const getActivityBody = (msg: any, req: any): string => {
    const text = msg.text || msg.content || '';
    // Truncate long messages
    if (text.length > 100) {
      return text.substring(0, 100) + '...';
    }
    return text;
  };

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchActivities();
  }, [fetchActivities]);

  const handleMarkAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      await markAllAsRead();
      // Update local state to show all as read
      setActivities(prev => prev.map(a => ({ ...a, isUnread: false })));
    } catch (err) {
      console.warn('[Notifications] Error marking all as read:', err);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleActivityPress = async (activity: ActivityItem) => {
    // Mark thread as read
    if (activity.isUnread) {
      markThreadAsRead(activity.requestId);
      setActivities(prev => 
        prev.map(a => a.requestId === activity.requestId ? { ...a, isUnread: false } : a)
      );
    }
    
    // Navigate to the request detail
    const isProvider = user?.role === 'provider' || user?.isProviderEnabled;
    if (isProvider) {
      router.push(`/(provider)/request-detail?requestId=${activity.requestId}`);
    } else {
      router.push(`/(customer)/request-detail?requestId=${activity.requestId}`);
    }
  };

  const getActivityIcon = (activity: ActivityItem): { name: keyof typeof Ionicons.glyphMap; color: string } => {
    if (activity.type === 'message') {
      return { name: 'chatbubble', color: '#00BCD4' };
    }
    
    // Status-based icons
    const title = activity.title.toLowerCase();
    if (title.includes('accepted')) return { name: 'checkmark-circle', color: '#4CAF50' };
    if (title.includes('declined')) return { name: 'close-circle', color: '#D74826' };
    if (title.includes('started')) return { name: 'play-circle', color: '#1976D2' };
    if (title.includes('completed')) return { name: 'checkmark-done-circle', color: '#7B1FA2' };
    if (title.includes('cancelled')) return { name: 'close-circle', color: '#FF5722' };
    if (title.includes('review')) return { name: 'star', color: '#FFB300' };
    if (title.includes('quote')) return { name: 'pricetag', color: '#009688' };
    if (title.includes('timeout')) return { name: 'time', color: '#FF9800' };
    return { name: 'notifications', color: '#666' };
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const localUnreadCount = activities.filter(a => a.isUnread).length;

  const renderActivity = ({ item }: { item: ActivityItem }) => {
    const icon = getActivityIcon(item);
    
    return (
      <TouchableOpacity
        style={[styles.activityItem, item.isUnread && styles.activityUnread]}
        onPress={() => handleActivityPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
          <Ionicons name={icon.name} size={24} color={icon.color} />
        </View>
        <View style={styles.activityContent}>
          <Text style={[styles.activityTitle, item.isUnread && styles.activityTitleUnread]}>
            {item.title}
          </Text>
          <Text style={styles.activityBody} numberOfLines={2}>
            {item.body}
          </Text>
          <View style={styles.activityMeta}>
            <Text style={styles.activityService}>{item.serviceType || 'Service'}</Text>
            <Text style={styles.activityTime}>{formatTime(item.timestamp)}</Text>
          </View>
        </View>
        {item.isUnread && <View style={styles.unreadDot} />}
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>
    );
  };

  // Loading state - only on initial load with no data
  if (loading && !initialLoadComplete && activities.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D74826" />
          <Text style={styles.loadingText}>{COPY.LOADING}</Text>
        </View>
      </View>
    );
  }

  // Error state with retry
  if (error && activities.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color="#999" />
          <Text style={styles.errorText}>{COPY.ERROR}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchActivities}>
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {localUnreadCount > 0 ? (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
            disabled={markingAllRead}
          >
            {markingAllRead ? (
              <ActivityIndicator size="small" color="#D74826" />
            ) : (
              <Text style={styles.markAllText}>Mark all read</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      {/* Badge count info when mismatched */}
      {unreadCount > 0 && localUnreadCount !== unreadCount && (
        <View style={styles.countInfo}>
          <Text style={styles.countInfoText}>
            Showing {activities.length} updates ({localUnreadCount} unread)
          </Text>
        </View>
      )}

      {initialLoadComplete && activities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>{COPY.EMPTY_TITLE}</Text>
          <Text style={styles.emptyText}>{COPY.EMPTY_MESSAGE}</Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivity}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D74826']} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  headerRight: {
    width: 80,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  markAllText: {
    fontSize: 14,
    color: '#D74826',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  countInfo: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  countInfoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
    textAlign: 'center',
    marginTop: 8,
  },
  listContent: {
    paddingVertical: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityUnread: {
    backgroundColor: '#FFF8F8',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  activityTitleUnread: {
    fontWeight: '600',
  },
  activityBody: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  activityService: {
    fontSize: 12,
    color: '#D74826',
    fontWeight: '500',
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D74826',
    marginRight: 8,
  },
});
