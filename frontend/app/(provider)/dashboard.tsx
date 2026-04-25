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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { api, formatApiError } from '../../utils/apiClient';
import BetaNoticeModal from '../../components/BetaNoticeModal';
import NotificationBell from '../../components/NotificationBell';
import { getStatusBadge, getEffectiveStatus } from '../../constants/statusStyles';
import {
  getCachedData,
  setCachedData,
  shouldRefetch,
  markFetchStarted,
  cancelRequest,
  createTimingTracker,
  isRequestInFlight,
  setRequestInFlight,
  isInBackoff,
  setBackoff,
  clearBackoff,
  CACHE_KEYS,
} from '../../utils/screenCache';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Consistent loading/empty state copy
const COPY = {
  LOADING: 'Loading...',
  EMPTY_TITLE: 'No jobs yet.',
  EMPTY_MESSAGE: 'When customers request your services,\ntheir jobs will appear here.',
  ERROR: "Couldn't load. Tap to retry.",
};

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
  paymentStatus?: string;  // 'pending' | 'held' | 'released' | 'captured'
  createdAt: string;
  preferredDateTime?: string;
  isGeneralRequest?: boolean;
  jobTown?: string;
  location?: string;
  // For per-user unread tracking
  hasUnreadMessages?: boolean;
  lastMessage?: Message;
  provider_last_read_at?: string;
  last_message_at?: string;
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

const isExpiredPendingJob = (job: ServiceRequest) => {
  const status = String(job.status || '').toLowerCase();
  if (status !== 'pending') return false;
  const createdMs = new Date(job.createdAt).getTime();
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs > 24 * 60 * 60 * 1000;
};

export default function ProviderMyJobsScreen() {
  const { token, user, shouldShowBetaNotice, markBetaNoticeSeen } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // INSTANT NAVIGATION: Initialize with cached data
  const cachedData = getCachedData<ServiceRequest[]>(CACHE_KEYS.PROVIDER_JOBS);
  const [jobs, setJobs] = useState<ServiceRequest[]>(cachedData || []);
  const [loading, setLoading] = useState(!cachedData); // Only show loading if no cache
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(!!cachedData);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Performance timing
  const timingRef = useRef(createTimingTracker('Provider My Jobs'));
  
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

  // Refetch on screen focus with COOLDOWN to prevent loops
  useFocusEffect(
    useCallback(() => {
      // Log first render timing
      timingRef.current.logFirstRender();
      
      // Reset navigation guard when screen comes into focus
      isNavigatingRef.current = false;
      
      // Check cooldown before refetching
      if (shouldRefetch(CACHE_KEYS.PROVIDER_JOBS)) {
        fetchJobs();
        fetchProviderProfile();
      } else if (cachedData) {
        // Use cached data, skip fetch
        setLoading(false);
        setInitialLoadComplete(true);
      }
      
      // Cleanup: cancel requests and stop polling when leaving
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        cancelRequest(CACHE_KEYS.PROVIDER_JOBS);
      };
    }, [token])
  );

  const handleBetaNoticeContinue = async () => {
    await markBetaNoticeSeen();
  };

  const fetchJobs = async () => {
    const cacheKey = CACHE_KEYS.PROVIDER_JOBS;
    
    // SINGLE-FLIGHT: Skip if already fetching
    if (isRequestInFlight(cacheKey)) {
      console.log('[FETCH] Provider My Jobs skip (already in-flight)');
      return;
    }
    
    // BACKOFF: Skip if in backoff period (after 429)
    if (isInBackoff(cacheKey)) {
      console.log('[FETCH] Provider My Jobs skip (in backoff)');
      return;
    }
    
    console.log('[NAV] Provider My Jobs focused');
    console.log('[FETCH] Provider My Jobs start');
    
    // Mark fetch started
    setRequestInFlight(cacheKey, true);
    markFetchStarted(cacheKey);
    
    try {
      const response = await api.get(`${BACKEND_URL}/api/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
        actionName: 'Load My Jobs',
      });
      
      if (!response.success || !response.data) {
        // Handle 429 backoff
        if (response.error?.statusCode === 429) {
          setBackoff(cacheKey, 1);
        }
        // Show error only if no existing data
        if (jobs.length === 0 && response.error) {
          setError(formatApiError(response.error));
        }
        console.log(`[FETCH] Provider My Jobs failed ${response.error?.statusCode || 'unknown'}`);
        return;
      }
      
      const allJobs = response.data || [];

      // FILTER: only hide expired pending jobs
      const filteredJobs = allJobs.filter((job: ServiceRequest) => {
        return !isExpiredPendingJob(job);
      });
      
      // SIMPLIFIED: Use last_message_at and provider_last_read_at from job data
      // NO MORE N+1 message fetches - just use the timestamps already in the data
      const jobsWithUnread = filteredJobs.map((job: ServiceRequest) => {
        let hasUnread = false;
        if (job.last_message_at) {
          const lastMsgTime = new Date(job.last_message_at).getTime();
          const lastReadTime = job.provider_last_read_at 
            ? new Date(job.provider_last_read_at).getTime() 
            : 0;
          hasUnread = lastMsgTime > lastReadTime;
        }
        return { ...job, hasUnreadMessages: hasUnread };
      });
      
      // Sort by status priority
      jobsWithUnread.sort((a: ServiceRequest, b: ServiceRequest) => {
        const priorityA = STATUS_PRIORITY[a.status] ?? 99;
        const priorityB = STATUS_PRIORITY[b.status] ?? 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      setJobs(jobsWithUnread);
      setCachedData(cacheKey, jobsWithUnread);
      clearBackoff(cacheKey);
      setError(null);
      
      console.log(`[FETCH] Provider My Jobs success (${jobsWithUnread.length} jobs)`);
      timingRef.current.logDataLoaded();
    } catch (err: any) {
      console.log(`[FETCH] Provider My Jobs failed ${err.message}`);
      if (jobs.length === 0) {
        setError(COPY.ERROR);
      }
    } finally {
      setRequestInFlight(cacheKey, false);
      setLoading(false);
      setRefreshing(false);
      setInitialLoadComplete(true);
    }
  };

  const fetchJobsQuietly = async () => {
    const cacheKey = CACHE_KEYS.PROVIDER_JOBS;
    
    // SINGLE-FLIGHT: Skip if already fetching
    if (isRequestInFlight(cacheKey) || isInBackoff(cacheKey)) {
      return;
    }
    
    try {
      setRequestInFlight(cacheKey, true);
      const response = await api.get(`${BACKEND_URL}/api/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
        actionName: 'Load My Jobs',
      });
      
      if (!response.success || !response.data) {
        if (response.error?.statusCode === 429) {
          setBackoff(cacheKey, 1);
        }
        return;
      }
      
      const allJobs = response.data || [];

      // FILTER: only hide expired pending jobs
      const filteredJobs = allJobs.filter((job: ServiceRequest) => {
        return !isExpiredPendingJob(job);
      });
      
      // Use timestamps from data - no extra fetches
      const jobsWithUnread = filteredJobs.map((job: ServiceRequest) => {
        let hasUnread = false;
        if (job.last_message_at) {
          const lastMsgTime = new Date(job.last_message_at).getTime();
          const lastReadTime = job.provider_last_read_at 
            ? new Date(job.provider_last_read_at).getTime() 
            : 0;
          hasUnread = lastMsgTime > lastReadTime;
        }
        return { ...job, hasUnreadMessages: hasUnread };
      });
      
      jobsWithUnread.sort((a: ServiceRequest, b: ServiceRequest) => {
        const priorityA = STATUS_PRIORITY[a.status] ?? 99;
        const priorityB = STATUS_PRIORITY[b.status] ?? 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      setJobs(jobsWithUnread);
      setCachedData(cacheKey, jobsWithUnread);
      clearBackoff(cacheKey);
    } catch {
      // Silent fail
    } finally {
      setRequestInFlight(cacheKey, false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  // Guard to prevent double-tap navigation
  const isNavigatingRef = useRef(false);

  const handleJobPress = (jobId: string) => {
    // Prevent double-tap: if already navigating, ignore
    if (isNavigatingRef.current) return;
    
    isNavigatingRef.current = true;
    
    router.push({
      pathname: '/(provider)/request-detail',
      params: { requestId: jobId },
    });
    
    // Reset after 800ms to allow future taps (shorter timeout for responsiveness)
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 800);
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

  // CRITICAL: Only show loading spinner on initial load (no data yet)
  // This prevents "empty flash" during rapid tab switching
  if (loading && !initialLoadComplete && jobs.length === 0) {
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
            <Ionicons name="warning-outline" size={14} color="#C13E1F" />
            <Text style={styles.availabilityErrorText}>{availabilityError}</Text>
          </View>
        )}
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#C13E1F" />
          <Text style={styles.loadingText}>{COPY.LOADING}</Text>
        </View>
      </View>
    );
  }

  // Error state with retry button (only if no data)
  if (error && jobs.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>My Jobs</Text>
          <NotificationBell color="#1A1A1A" size={24} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="cloud-offline-outline" size={48} color="#999" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchJobs}>
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Empty state - ONLY show when initial load is complete AND truly empty
  if (initialLoadComplete && jobs.length === 0) {
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
        {/* Error toast for availability toggle */}
        {availabilityError && (
          <View style={styles.availabilityErrorContainer}>
            <Ionicons name="warning-outline" size={14} color="#C13E1F" />
            <Text style={styles.availabilityErrorText}>{availabilityError}</Text>
          </View>
        )}
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Ionicons name="briefcase-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>{COPY.EMPTY_TITLE}</Text>
          <Text style={styles.emptySubtitle}>{COPY.EMPTY_MESSAGE}</Text>
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
      {/* Error toast for availability toggle */}
      {availabilityError && (
        <View style={styles.availabilityErrorContainer}>
          <Ionicons name="warning-outline" size={14} color="#C13E1F" />
          <Text style={styles.availabilityErrorText}>{availabilityError}</Text>
        </View>
      )}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#C13E1F"
          />
        }
      >
        {jobs.map((job) => {
          const effectiveStatus = getEffectiveStatus(job);
          const statusBadge = getStatusBadge(effectiveStatus);
          
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
                  <Ionicons name="chevron-forward" size={20} color="#C13E1F" />
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
  // Error toast styles for availability toggle
  availabilityErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  availabilityErrorText: {
    fontSize: 13,
    color: '#C13E1F',
    flex: 1,
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
    backgroundColor: '#C13E1F',
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
    backgroundColor: '#C13E1F',
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
    color: '#C13E1F',
    fontWeight: '600',
  },
});
