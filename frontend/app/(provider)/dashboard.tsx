import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import BetaNoticeModal from '../../components/BetaNoticeModal';
import NotificationBell from '../../components/NotificationBell';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Message {
  _id: string;
  senderId: string;
  senderRole: string;
  text: string;
  createdAt: string;
}

interface ServiceRequest {
  _id: string;
  service: string;
  serviceSubcategory?: string;
  subCategory?: string;
  description: string;
  customerName: string;
  customerPhone: string;
  status: string;
  createdAt: string;
  preferredDateTime?: string;
  isGeneralRequest?: boolean;
  jobTown?: string;
  location?: string;
  // For unread tracking
  hasUnreadMessages?: boolean;
  lastMessage?: Message;
}

// Status priority for sorting
const STATUS_PRIORITY: { [key: string]: number } = {
  'pending': 0,
  'accepted': 1,
  'in_progress': 2,
  'completed': 3,
  'cancelled': 4,
  'declined': 5,
};

export default function ProviderMyJobsScreen() {
  const { token, user, shouldShowBetaNotice, markBetaNoticeSeen } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Availability status state (Phase 3A)
  const [availabilityStatus, setAvailabilityStatus] = useState<'available' | 'away'>('available');
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  // Fetch provider profile to get current availability status
  const fetchProviderProfile = async () => {
    // Don't fetch if we're in the middle of toggling (prevents bounce)
    if (isTogglingAvailability) return;
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/providers/me/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const status = response.data.availabilityStatus || 'available';
      // Only update if not currently toggling
      if (!isTogglingAvailability) {
        setAvailabilityStatus(status);
      }
    } catch {
      // Silent fail - keep current state
    }
  };

  // Toggle availability status with optimistic UI + in-flight lock
  const toggleAvailability = async (newValue: boolean) => {
    // Prevent double-taps while request is in flight
    if (isTogglingAvailability) return;
    
    const newStatus = newValue ? 'available' : 'away';
    const previousStatus = availabilityStatus;
    
    // OPTIMISTIC UI: Update immediately
    setAvailabilityStatus(newStatus);
    setIsTogglingAvailability(true);
    setAvailabilityError(null);
    
    try {
      await axios.patch(
        `${BACKEND_URL}/api/providers/me/availability`,
        { availabilityStatus: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Success - state already updated optimistically
    } catch {
      // REVERT on error
      setAvailabilityStatus(previousStatus);
      setAvailabilityError('Failed to update. Try again.');
      // Clear error after 3 seconds
      setTimeout(() => setAvailabilityError(null), 3000);
    } finally {
      setIsTogglingAvailability(false);
    }
  };

  // Refetch on screen focus to get latest status
  useFocusEffect(
    useCallback(() => {
      fetchJobs();
      fetchProviderProfile();
      
      // Poll for updates every 3 seconds
      pollingRef.current = setInterval(() => {
        fetchJobsQuietly();
      }, 3000);
      
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }, [token])
  );

  const handleBetaNoticeContinue = async () => {
    await markBetaNoticeSeen();
  };

  const fetchJobs = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const allJobs = response.data || [];
      
      // Fetch messages for each job to check for unread
      const jobsWithMessages = await Promise.all(
        allJobs.map(async (job: ServiceRequest) => {
          try {
            const msgResponse = await axios.get(
              `${BACKEND_URL}/api/service-requests/${job._id}/messages`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const messages = msgResponse.data.messages || [];
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
            
            // Check if there are unread messages from customer
            const customerMessages = messages.filter((m: Message) => m.senderRole === 'customer');
            const hasUnread = customerMessages.length > 0 && 
              customerMessages[customerMessages.length - 1].senderId !== user?._id;
            
            return {
              ...job,
              hasUnreadMessages: hasUnread,
              lastMessage,
            };
          } catch {
            return { ...job, hasUnreadMessages: false };
          }
        })
      );
      
      // Sort by status priority
      jobsWithMessages.sort((a, b) => {
        const priorityA = STATUS_PRIORITY[a.status] ?? 99;
        const priorityB = STATUS_PRIORITY[b.status] ?? 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        // Secondary sort by date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      setJobs(jobsWithMessages);
    } catch (error) {
      if (__DEV__) {
        console.warn('Error fetching jobs:', error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchJobsQuietly = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const allJobs = response.data || [];
      
      // Quick check for messages
      const jobsWithMessages = await Promise.all(
        allJobs.map(async (job: ServiceRequest) => {
          try {
            const msgResponse = await axios.get(
              `${BACKEND_URL}/api/service-requests/${job._id}/messages`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const messages = msgResponse.data.messages || [];
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
            const customerMessages = messages.filter((m: Message) => m.senderRole === 'customer');
            const hasUnread = customerMessages.length > 0 && 
              customerMessages[customerMessages.length - 1].senderId !== user?._id;
            
            return { ...job, hasUnreadMessages: hasUnread, lastMessage };
          } catch {
            return { ...job, hasUnreadMessages: false };
          }
        })
      );
      
      jobsWithMessages.sort((a, b) => {
        const priorityA = STATUS_PRIORITY[a.status] ?? 99;
        const priorityB = STATUS_PRIORITY[b.status] ?? 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      setJobs(jobsWithMessages);
    } catch {
      // Silent fail
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  const handleJobPress = (jobId: string) => {
    router.push({
      pathname: '/provider-request-detail',
      params: { requestId: jobId },
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending Review', color: '#4A7DC4', bgColor: '#EAF3FF' };
      case 'accepted':
        return { label: 'Accepted', color: '#4CAF50', bgColor: '#E8F5E9' };
      case 'in_progress':
        return { label: 'In Progress', color: '#FF9800', bgColor: '#FFF3E0' };
      case 'completed':
        return { label: 'Completed', color: '#9C27B0', bgColor: '#F3E5F5' };
      case 'cancelled':
        return { label: 'Cancelled', color: '#F44336', bgColor: '#FFEBEE' };
      case 'declined':
        return { label: 'Declined', color: '#757575', bgColor: '#F5F5F5' };
      default:
        return { label: status, color: '#666', bgColor: '#F5F5F5' };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getServiceDisplay = (job: ServiceRequest) => {
    const service = job.service || 'Service';
    const subcategory = job.serviceSubcategory || job.subCategory;
    if (subcategory) {
      return `${service} • ${subcategory}`;
    }
    return service;
  };

  const getLocationDisplay = (job: ServiceRequest) => {
    return job.jobTown || job.location || 'Location not specified';
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>My Jobs</Text>
          <NotificationBell color="#1A1A1A" size={24} />
        </View>
        {/* Availability Toggle - Phase 3A */}
        <View style={styles.availabilityContainer}>
          <View style={styles.availabilityLeft}>
            <View style={[
              styles.availabilityDot,
              { backgroundColor: availabilityStatus === 'available' ? '#4CAF50' : '#9E9E9E' }
            ]} />
            <View>
              <Text style={styles.availabilityLabel}>Availability</Text>
              <Text style={[
                styles.availabilityStatus,
                { color: availabilityStatus === 'available' ? '#2E7D32' : '#757575' }
              ]}>
                {availabilityStatus === 'available' ? 'Available' : 'Away'}
              </Text>
            </View>
          </View>
          <Switch
            value={availabilityStatus === 'available'}
            onValueChange={toggleAvailability}
            trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
            thumbColor={availabilityStatus === 'available' ? '#4CAF50' : '#9E9E9E'}
            disabled={isTogglingAvailability}
          />
        </View>
        {/* Error toast for availability toggle */}
        {availabilityError && (
          <View style={styles.availabilityErrorContainer}>
            <Ionicons name="warning-outline" size={14} color="#C62828" />
            <Text style={styles.availabilityErrorText}>{availabilityError}</Text>
          </View>
        )}
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#E53935" />
        </View>
      </View>
    );
  }

  if (jobs.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <BetaNoticeModal 
          visible={shouldShowBetaNotice} 
          onClose={handleBetaNoticeContinue}
        />
        <View style={styles.header}>
          <Text style={styles.title}>My Jobs</Text>
          <NotificationBell color="#1A1A1A" size={24} />
        </View>
        {/* Availability Toggle - Phase 3A */}
        <View style={styles.availabilityContainer}>
          <View style={styles.availabilityLeft}>
            <View style={[
              styles.availabilityDot,
              { backgroundColor: availabilityStatus === 'available' ? '#4CAF50' : '#9E9E9E' }
            ]} />
            <View>
              <Text style={styles.availabilityLabel}>Availability</Text>
              <Text style={[
                styles.availabilityStatus,
                { color: availabilityStatus === 'available' ? '#2E7D32' : '#757575' }
              ]}>
                {availabilityStatus === 'available' ? 'Available' : 'Away'}
              </Text>
            </View>
          </View>
          <Switch
            value={availabilityStatus === 'available'}
            onValueChange={toggleAvailability}
            trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
            thumbColor={availabilityStatus === 'available' ? '#4CAF50' : '#9E9E9E'}
            disabled={isTogglingAvailability}
          />
        </View>
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Ionicons name="briefcase-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>No Jobs Yet</Text>
          <Text style={styles.emptySubtitle}>
            When customers request your services,
            {"\n"}their jobs will appear here.
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <BetaNoticeModal 
        visible={shouldShowBetaNotice} 
        onClose={handleBetaNoticeContinue}
      />
      <View style={styles.header}>
        <Text style={styles.title}>My Jobs</Text>
        <View style={styles.headerRight}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{jobs.length}</Text>
          </View>
          <NotificationBell color="#1A1A1A" size={24} />
        </View>
      </View>
      {/* Availability Toggle - Phase 3A */}
      <View style={styles.availabilityContainer}>
        <View style={styles.availabilityLeft}>
          <View style={[
            styles.availabilityDot,
            { backgroundColor: availabilityStatus === 'available' ? '#4CAF50' : '#9E9E9E' }
          ]} />
          <View>
            <Text style={styles.availabilityLabel}>Availability</Text>
            <Text style={[
              styles.availabilityStatus,
              { color: availabilityStatus === 'available' ? '#2E7D32' : '#757575' }
            ]}>
              {availabilityStatus === 'available' ? 'Available' : 'Away'}
            </Text>
          </View>
        </View>
        <Switch
          value={availabilityStatus === 'available'}
          onValueChange={toggleAvailability}
          trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
          thumbColor={availabilityStatus === 'available' ? '#4CAF50' : '#9E9E9E'}
          disabled={isTogglingAvailability}
        />
      </View>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#E53935"
          />
        }
      >
        {jobs.map((job) => {
          const statusBadge = getStatusBadge(job.status);
          
          return (
            <TouchableOpacity
              key={job._id}
              style={styles.jobCard}
              onPress={() => handleJobPress(job._id)}
              activeOpacity={0.7}
            >
              {/* Header: Service + Status Badge */}
              <View style={styles.jobHeader}>
                <View style={styles.serviceContainer}>
                  <Ionicons name="construct" size={16} color="#666" />
                  <Text style={styles.serviceText} numberOfLines={1}>
                    {getServiceDisplay(job)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusBadge.bgColor }]}>
                  <Text style={[styles.statusText, { color: statusBadge.color }]}>
                    {statusBadge.label}
                  </Text>
                </View>
              </View>

              {/* Customer Name + Unread Indicator */}
              <View style={styles.customerRow}>
                <Text style={styles.customerName}>{job.customerName}</Text>
                {job.hasUnreadMessages && (
                  <View style={styles.unreadDot} />
                )}
              </View>

              {/* Location */}
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="#999" />
                <Text style={styles.locationText}>{getLocationDisplay(job)}</Text>
              </View>

              {/* Footer: Date + Action */}
              <View style={styles.jobFooter}>
                <View style={styles.dateContainer}>
                  <Ionicons name="time-outline" size={14} color="#999" />
                  <Text style={styles.dateText}>
                    {formatDate(job.createdAt)}
                  </Text>
                </View>
                <View style={styles.actionContainer}>
                  <Text style={styles.actionText}>
                    {job.status === 'pending' ? 'Review' : 'View'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#E53935" />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#F8F9FA',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  // Availability toggle styles - Phase 3A
  availabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  availabilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  availabilityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  availabilityLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  availabilityStatus: {
    fontSize: 16,
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
    paddingHorizontal: 48,
    minHeight: 500,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 16,
  },
  serviceText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E53935',
    marginLeft: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 13,
    color: '#999',
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    color: '#E53935',
    fontWeight: '600',
  },
});
