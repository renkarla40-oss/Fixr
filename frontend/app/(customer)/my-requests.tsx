import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { api, formatApiError } from '../../utils/apiClient';
import { getStatusColor, STATUS_LABELS, getEffectiveStatus } from '../../constants/statusStyles';
import {
  getCachedData,
  setCachedData,
  isCacheFresh,
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
  EMPTY_TITLE: 'No requests yet.',
  EMPTY_MESSAGE: 'When you request services from providers,\nthey\'ll appear here.',
  ERROR: "Couldn't load. Tap to retry.",
};

// Polling interval for status updates (20 seconds)
const POLLING_INTERVAL_MS = 20000;

interface ServiceRequest {
  _id: string;
  service: string;
  description: string;
  providerName: string;
  status: string;
  paymentStatus?: string;  // 'pending' | 'held' | 'released' | 'captured'
  createdAt: string;
  preferredDateTime?: string;
  subCategory?: string;
  location?: string;
}

export default function MyRequestsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  
  // INSTANT NAVIGATION: Initialize with cached data
  const cachedData = getCachedData<ServiceRequest[]>(CACHE_KEYS.CUSTOMER_REQUESTS);
  const [requests, setRequests] = useState<ServiceRequest[]>(cachedData || []);
  const [loading, setLoading] = useState(!cachedData); // Only show loading if no cache
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(!!cachedData);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Performance timing
  const timingRef = useRef(createTimingTracker('Customer My Requests'));

  // Refetch on screen focus with COOLDOWN to prevent loops
  useFocusEffect(
    useCallback(() => {
      // Log first render timing
      timingRef.current.logFirstRender();
      
      // Check cooldown before refetching
      if (shouldRefetch(CACHE_KEYS.CUSTOMER_REQUESTS)) {
        fetchRequests();
      } else if (cachedData) {
        // Use cached data, skip fetch
        setLoading(false);
        setInitialLoadComplete(true);
      }
      
      // Set up polling every 20 seconds while screen is focused
      pollingIntervalRef.current = setInterval(() => {
        fetchRequestsQuietly();
      }, POLLING_INTERVAL_MS);
      
      // Cleanup: stop polling and cancel requests when screen loses focus
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        cancelRequest(CACHE_KEYS.CUSTOMER_REQUESTS);
      };
    }, [token])
  );

  // Main fetch with loading state using universal apiClient
  const fetchRequests = async () => {
    const cacheKey = CACHE_KEYS.CUSTOMER_REQUESTS;
    
    // SINGLE-FLIGHT: Skip if already fetching
    if (isRequestInFlight(cacheKey)) {
      console.log('[FETCH] Customer My Requests skip (already in-flight)');
      return;
    }
    
    // BACKOFF: Skip if in backoff period (after 429)
    if (isInBackoff(cacheKey)) {
      console.log('[FETCH] Customer My Requests skip (in backoff)');
      return;
    }
    
    console.log('[NAV] Customer My Requests focused');
    console.log('[FETCH] Customer My Requests start');
    
    // Mark fetch started
    setRequestInFlight(cacheKey, true);
    markFetchStarted(cacheKey);
    
    try {
      setError(null);
      const response = await api.get(`${BACKEND_URL}/api/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
        actionName: 'Load My Requests',
      });
      
      if (response.success && response.data) {
        setRequests(response.data);
        setCachedData(cacheKey, response.data);
        clearBackoff(cacheKey);
        console.log(`[FETCH] Customer My Requests success (${response.data.length} requests)`);
        timingRef.current.logDataLoaded();
      } else if (response.error) {
        // Handle 429 backoff
        if (response.error.statusCode === 429) {
          setBackoff(cacheKey, 1);
        }
        // Only show error if no existing data
        if (requests.length === 0) {
          setError(formatApiError(response.error));
        }
        console.log(`[FETCH] Customer My Requests failed ${response.error.statusCode || 'unknown'}`);
      }
    } catch (err) {
      console.log('[FETCH] Customer My Requests failed (exception)');
      if (requests.length === 0) {
        setError(COPY.ERROR);
      }
    } finally {
      setRequestInFlight(cacheKey, false);
      setLoading(false);
      setRefreshing(false);
      setInitialLoadComplete(true);
    }
  };

  // Quiet fetch for polling (no loading state change)
  const fetchRequestsQuietly = async () => {
    const cacheKey = CACHE_KEYS.CUSTOMER_REQUESTS;
    
    // SINGLE-FLIGHT: Skip if already fetching
    if (isRequestInFlight(cacheKey) || isInBackoff(cacheKey)) {
      return;
    }
    
    try {
      setRequestInFlight(cacheKey, true);
      const response = await api.get(`${BACKEND_URL}/api/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
        actionName: 'Load My Requests',
      });
      
      if (response.success && response.data) {
        setRequests(response.data);
        setCachedData(cacheKey, response.data);
        clearBackoff(cacheKey);
      } else if (response.error?.statusCode === 429) {
        setBackoff(cacheKey, 1);
      }
    } catch (error) {
      // Silent fail for polling
    } finally {
      setRequestInFlight(cacheKey, false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  // Guard to prevent double-tap navigation
  const isNavigatingRef = useRef(false);

  const handleRequestPress = (requestId: string) => {
    // Prevent double-tap: if already navigating, ignore
    if (isNavigatingRef.current) return;
    
    isNavigatingRef.current = true;
    
    router.push({
      pathname: '/(customer)/request-detail',
      params: { requestId },
    });
    
    // Reset after 1000ms to allow future taps
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 1000);
  };

  const categoryNames: { [key: string]: string } = {
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    ac: 'AC Repair',
    cleaning: 'Cleaning',
    handyman: 'Handyman',
  };

  // Use shared getStatusColor and getEffectiveStatus from constants/statusStyles.ts

  const getStatusLabel = (status: string) => {
    // Add ready_to_start to labels
    if (status === 'ready_to_start') return 'Ready to Start';
    return STATUS_LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // CRITICAL: Only show loading spinner on initial load (no data yet)
  // This prevents "empty flash" during rapid tab switching
  if (loading && !initialLoadComplete && requests.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>My Requests</Text>
          </View>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#E53935" />
            <Text style={styles.loadingText}>{COPY.LOADING}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Error state with retry button (only if no data)
  if (error && requests.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>My Requests</Text>
          </View>
          <View style={styles.centerContent}>
            <Ionicons name="cloud-offline-outline" size={48} color="#999" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchRequests}>
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state - ONLY show when initial load is complete AND truly empty
  if (initialLoadComplete && requests.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>My Requests</Text>
          </View>
          <ScrollView
            contentContainerStyle={styles.emptyContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            <Ionicons name="document-text-outline" size={64} color="#CCC" />
            <Text style={styles.emptyTitle}>{COPY.EMPTY_TITLE}</Text>
            <Text style={styles.emptySubtitle}>{COPY.EMPTY_MESSAGE}</Text>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Requests</Text>
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
          {requests.map((request) => {
            const effectiveStatus = getEffectiveStatus(request);
            const statusColors = getStatusColor(effectiveStatus);
            return (
              <TouchableOpacity
                key={request._id}
                style={styles.requestCard}
                onPress={() => handleRequestPress(request._id)}
                activeOpacity={0.7}
              >
                <View style={styles.requestHeader}>
                  <View style={styles.categoryContainer}>
                    <Ionicons name="construct" size={16} color="#666" />
                    <Text style={styles.categoryText}>
                      {categoryNames[request.service] || request.service}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusColors.bg },
                    ]}
                  >
                    <Text
                      style={[styles.statusText, { color: statusColors.text }]}
                    >
                      {getStatusLabel(effectiveStatus)}
                    </Text>
                  </View>
                </View>

                {/* Show sub-category if present */}
                {request.subCategory && (
                  <Text style={styles.subCategoryText}>{request.subCategory}</Text>
                )}

                <Text style={styles.providerName}>{request.providerName || 'Open Request'}</Text>

                <Text style={styles.description} numberOfLines={2}>
                  {request.description}
                </Text>

                {/* Show location if present */}
                {request.location && (
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={14} color="#E53935" />
                    <Text style={styles.locationText}>{request.location}</Text>
                  </View>
                )}

                <View style={styles.requestFooter}>
                  <View style={styles.dateContainer}>
                    <Ionicons name="calendar-outline" size={14} color="#999" />
                    <Text style={styles.dateText}>
                      {formatDate(request.createdAt)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#F8F9FA',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
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
    backgroundColor: '#E53935',
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
    paddingBottom: 90,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subCategoryText: {
    fontSize: 13,
    color: '#E53935',
    fontWeight: '500',
    marginBottom: 8,
  },
  providerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 13,
    color: '#E53935',
    fontWeight: '500',
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
});
