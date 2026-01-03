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
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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

// Debug state for troubleshooting
interface DebugInfo {
  jobsLoaded: number;
  jobsWithMessages: number;
  threadsRendered: number;
  errors: string[];
}

export default function ProviderInboxScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [jobsWithMessages, setJobsWithMessages] = useState<JobWithMessages[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({ jobsLoaded: 0, jobsWithMessages: 0, threadsRendered: 0, errors: [] });
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJobsWithMessages = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const errors: string[] = [];
    
    try {
      // Fetch all provider's jobs
      const response = await axios.get(`${BACKEND_URL}/api/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const allJobs = response.data || [];
      const jobsWithMsgs: JobWithMessages[] = [];
      let jobsWithMsgCount = 0;
      
      // Check each job for messages
      for (const job of allJobs) {
        try {
          const msgResponse = await axios.get(
            `${BACKEND_URL}/api/service-requests/${job._id}/messages`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          const messages: Message[] = msgResponse.data.messages || [];
          
          if (messages.length > 0) {
            jobsWithMsgCount++;
          }
          
          // Include ALL jobs that have messages (including completed for dispute/verification)
          // Also include active jobs even without messages
          const isActiveJob = ['pending', 'accepted', 'started', 'in_progress'].includes(job.status);
          if (messages.length > 0 || isActiveJob) {
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;
            
            // Check for unread (last message from customer and not read)
            const hasUnread = lastMessage ? (lastMessage.senderRole === 'customer' && !lastMessage.readAt) : false;
            
            jobsWithMsgs.push({
              requestId: job._id,
              service: job.service || 'Unknown Service',
              serviceSubcategory: job.serviceSubcategory || job.subCategory,
              customerName: job.customerName || 'Customer',
              status: job.status,
              jobTown: job.jobTown || job.location,
              lastMessage,
              hasUnread,
              messageCount: messages.length,
            });
          }
        } catch (msgErr: any) {
          errors.push(`Job ${job._id}: ${msgErr.message || 'Failed to fetch messages'}`);
        }
      }
      
      // Sort by most recent message (jobs without messages go to the end)
      jobsWithMsgs.sort((a, b) => {
        const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      setJobsWithMessages(jobsWithMsgs);
      setDebugInfo({
        jobsLoaded: allJobs.length,
        jobsWithMessages: jobsWithMsgCount,
        threadsRendered: jobsWithMsgs.length,
        errors,
      });
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error fetching jobs';
      errors.push(`Main fetch: ${errorMsg}`);
      setDebugInfo(prev => ({ ...prev, errors }));
      console.warn('Error fetching inbox:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, user]);

  // Initial fetch and polling setup
  useEffect(() => {
    fetchJobsWithMessages();
    
    // Poll every 3 seconds for real-time updates
    pollingRef.current = setInterval(() => {
      fetchJobsWithMessages(false);
    }, 3000);
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchJobsWithMessages(false);
    }, [fetchJobsWithMessages])
  );

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
    router.push({ 
      pathname: '/provider-request-detail', 
      params: { requestId, openChat: 'true' } 
    });
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
          <Text style={styles.timestamp}>{formatTime(item.lastMessage.createdAt)}</Text>
        </View>
        
        {/* Service */}
        <Text style={styles.serviceName} numberOfLines={1}>
          {item.service}{item.serviceSubcategory ? ` • ${item.serviceSubcategory}` : ''}
        </Text>
        
        {/* Last Message Preview */}
        <Text style={[styles.lastMessage, item.hasUnread && styles.textBold]} numberOfLines={1}>
          {item.lastMessage.senderRole === 'provider' ? 'You: ' : ''}
          {item.lastMessage.text}
        </Text>
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

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Inbox</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#E53935" />
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
      
      {jobsWithMessages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>No Messages</Text>
          <Text style={styles.emptyText}>
            Messages from your jobs will appear here.
            {"\n"}Start by accepting a job request.
          </Text>
        </View>
      ) : (
        <FlatList
          data={jobsWithMessages}
          renderItem={renderJobItem}
          keyExtractor={(item) => item.requestId}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E53935" />
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
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
  },
  jobItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
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
    marginRight: 12,
  },
  jobContent: {
    flex: 1,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
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
    color: '#E53935',
    marginBottom: 2,
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
    backgroundColor: '#E53935',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 78,
  },
});
