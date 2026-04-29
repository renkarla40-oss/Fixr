import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../contexts/FavoritesContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Same Provider interface as provider-list.tsx
interface Provider {
  _id: string;
  name: string;
  services: string[];
  bio: string;
  verificationStatus: string;
  baseTown?: string;
  travelDistanceKm?: number;
  travelAnywhere?: boolean;
  distanceFromJob?: number;
  isOutsideSelectedArea?: boolean;
  isAcceptingJobs?: boolean;
  availabilityStatus?: string;
  availabilityNote?: string;
  profilePhotoUrl?: string;
  phoneVerified?: boolean;
  uploadsComplete?: boolean;
  completedJobsCount?: number;
  averageRating?: number;
  totalReviews?: number;
}

// Sort options - simplified for directory
type SortOption = 'default' | 'rating' | 'jobs';
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'jobs', label: 'Most Jobs' },
];

type AvailabilityFilter = 'all' | 'available';

export default function ProviderDirectoryScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const insets = useSafeAreaInsets();

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Sorting & Filtering state - same as provider-list
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);

  // Memoized filtered and sorted providers - same logic as provider-list
  const filteredAndSortedProviders = useMemo(() => {
    let result = [...providers];

    // Apply availability filter
    if (availabilityFilter === 'available') {
      result = result.filter(p => p.availabilityStatus !== 'away');
    }

    // Apply verified filter
    if (verifiedOnly) {
      result = result.filter(p => p.verificationStatus === 'verified');
    }

    // Apply sorting
    switch (sortBy) {
      case 'rating':
        result.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
        break;
      case 'jobs':
        result.sort((a, b) => (b.completedJobsCount || 0) - (a.completedJobsCount || 0));
        break;
      default:
        break;
    }

    return result;
  }, [providers, sortBy, availabilityFilter, verifiedOnly]);

  // Fetch all providers
  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);

      const response = await axios.get(`${BACKEND_URL}/api/providers`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProviders(response.data || []);
    } catch (error: any) {
      if (__DEV__) {
        console.warn('Provider fetch failed:', error?.message || 'Unknown error');
      }

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        setFetchError('Please sign in to view providers.');
      } else if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network')) {
        setFetchError('Unable to connect. Please check your internet connection.');
      } else {
        setFetchError('Unable to load providers. Please try again.');
      }

      setProviders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProviders();
  };

  // Navigate to provider detail - SAME as provider-list but with fromDirectory flag
  const handleProviderPress = (providerId: string, isAway: boolean = false) => {
    if (isAway) {
      Alert.alert(
        'Provider Unavailable',
        'This provider is currently away and not accepting new jobs. You can still view their profile.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View Profile',
            onPress: () => navigateToProviderDetail(providerId),
          },
        ]
      );
      return;
    }

    navigateToProviderDetail(providerId);
  };

  // EXACT same navigation as provider-list.tsx, but without requestId (directory mode)
  const navigateToProviderDetail = (providerId: string) => {
    router.push({
      pathname: '/provider-detail',
      params: {
        providerId,
        // No requestId - this signals directory browsing mode
        fromDirectory: 'true',
      },
    });
  };

  // Handle "Create Request" CTA
  const handleCreateRequest = () => {
    router.push('/(customer)/home');
  };

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        {/* Header - same as provider-list */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.title}>Provider Directory</Text>
          <View style={styles.backButton} />
        </View>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#C13E1F" />
          </View>
        ) : fetchError ? (
          <View style={styles.centerContent}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="cloud-offline-outline" size={48} color="#C13E1F" />
            </View>
            <Text style={styles.emptyTitle}>Something Went Wrong</Text>
            <Text style={styles.emptySubtitle}>{fetchError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchProviders()}>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : providers.length === 0 ? (
          <View style={styles.centerContent}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="people-outline" size={48} color="#C13E1F" />
            </View>
            <Text style={styles.emptyTitle}>No Providers Available</Text>
            <Text style={styles.emptySubtitle}>
              No providers are available right now. Please try again later.
            </Text>
            <TouchableOpacity style={styles.backToServicesButton} onPress={handleCreateRequest}>
              <Text style={styles.backToServicesText}>Browse Services</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#C13E1F" />
            }
          >
            {/* Results summary */}
            <View style={styles.resultsSummary}>
              <Text style={styles.resultsText}>
                {filteredAndSortedProviders.length} provider{filteredAndSortedProviders.length !== 1 ? 's' : ''} available
              </Text>
            </View>

            {/* Filter & Sort Controls - SAME as provider-list */}
            <View style={styles.sortFilterBar}>
              <TouchableOpacity
                style={[styles.filterPillBase, sortBy !== 'default' && styles.filterPillActive]}
                onPress={() => {
                  const opts: SortOption[] = ['default', 'rating', 'jobs'];
                  const idx = opts.indexOf(sortBy);
                  setSortBy(opts[(idx + 1) % opts.length]);
                }}
              >
                <Ionicons name="swap-vertical" size={14} color={sortBy !== 'default' ? '#FFFFFF' : '#C13E1F'} />
                <Text
                  style={[styles.filterPillText, sortBy !== 'default' && styles.filterPillTextActive]}
                  numberOfLines={1}
                >
                  {SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPillBase, availabilityFilter === 'all' && styles.filterPillActive]}
                onPress={() => setAvailabilityFilter('all')}
              >
                <Text
                  style={[styles.filterPillText, availabilityFilter === 'all' && styles.filterPillTextActive]}
                  numberOfLines={1}
                >
                  All
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPillBase, availabilityFilter === 'available' && styles.filterPillActive]}
                onPress={() => setAvailabilityFilter('available')}
              >
                <Text
                  style={[styles.filterPillText, availabilityFilter === 'available' && styles.filterPillTextActive]}
                  numberOfLines={1}
                >
                  Available
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPillBase, verifiedOnly && styles.filterPillActive]}
                onPress={() => setVerifiedOnly(!verifiedOnly)}
              >
                <Ionicons name="checkmark-circle" size={14} color={verifiedOnly ? '#FFFFFF' : '#C13E1F'} />
                <Text
                  style={[styles.filterPillText, verifiedOnly && styles.filterPillTextActive]}
                  numberOfLines={1}
                >
                  Verified
                </Text>
              </TouchableOpacity>
            </View>

            {/* Filtered results count */}
            {(availabilityFilter !== 'all' || verifiedOnly || sortBy !== 'default') && (
              <View style={styles.filterStatusBar}>
                <Text style={styles.filterStatusText}>
                  Showing {filteredAndSortedProviders.length} of {providers.length} providers
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSortBy('default');
                    setAvailabilityFilter('all');
                    setVerifiedOnly(false);
                  }}
                >
                  <Text style={styles.clearFiltersText}>Clear all</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Provider Cards - EXACT same layout as provider-list.tsx */}
            {filteredAndSortedProviders.map((provider) => {
              const isAway = provider.availabilityStatus === 'away';
              const favorited = isFavorite(provider._id);

              return (
                <TouchableOpacity
                  key={provider._id}
                  style={styles.providerCard}
                  onPress={() => handleProviderPress(provider._id, isAway)}
                  activeOpacity={0.7}
                >
                  <View style={styles.providerHeader}>
                    <View style={styles.avatarContainer}>
                      {provider.profilePhotoUrl ? (
                        <Image
                          source={{
                            uri: provider.profilePhotoUrl.startsWith('/')
                              ? `${BACKEND_URL}${provider.profilePhotoUrl}`
                              : provider.profilePhotoUrl,
                          }}
                          style={styles.avatarImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="person" size={24} color="#666" />
                      )}
                    </View>
                    <View style={styles.providerInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.providerName}>{provider.name}</Text>
                      </View>
                      <View style={styles.statusRow}>
                        <Ionicons
                          name={provider.verificationStatus === 'verified' ? 'checkmark-circle' : 'time-outline'}
                          size={14}
                          color={provider.verificationStatus === 'verified' ? '#2E7D32' : '#4A7DC4'}
                        />
                        <Text
                          style={[
                            styles.statusText,
                            provider.verificationStatus === 'verified'
                              ? styles.statusTextVerified
                              : styles.statusTextPending,
                          ]}
                        >
                          {provider.verificationStatus === 'verified' ? 'Verified Provider' : 'Verification Pending'}
                        </Text>
                      </View>
                    </View>
                    {/* Favorite heart button */}
                    <TouchableOpacity
                      style={styles.favoriteButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleFavorite(provider._id);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name={favorited ? 'heart' : 'heart-outline'} size={22} color={favorited ? '#C13E1F' : '#999'} />
                    </TouchableOpacity>
                  </View>

                  {/* Badges - same as provider-list */}
                  <View style={styles.badgeContainer}>
                    {isAway ? (
                      <View style={styles.awayBadge}>
                        <View style={styles.awayDot} />
                        <Text style={styles.awayBadgeText}>Away</Text>
                      </View>
                    ) : (
                      <View style={styles.availableNowBadge}>
                        <View style={styles.availableNowDot} />
                        <Text style={styles.availableNowBadgeText}>Available now</Text>
                      </View>
                    )}

                    {provider.uploadsComplete && (
                      <View style={styles.trustBadge}>
                        <Ionicons name="checkmark-circle" size={12} color="#2E7D32" />
                        <Text style={styles.trustBadgeText}>ID on file</Text>
                      </View>
                    )}

                    {provider.phoneVerified && (
                      <View style={styles.trustBadge}>
                        <Ionicons name="call" size={12} color="#2E7D32" />
                        <Text style={styles.trustBadgeText}>Phone verified</Text>
                      </View>
                    )}

                    {(provider.completedJobsCount || 0) > 0 && (
                      <View style={styles.jobsBadge}>
                        <Ionicons name="briefcase-outline" size={12} color="#1565C0" />
                        <Text style={styles.jobsBadgeText}>
                          {provider.completedJobsCount} job{(provider.completedJobsCount || 0) !== 1 ? 's' : ''} completed
                        </Text>
                      </View>
                    )}

                    {provider.averageRating && provider.averageRating > 0 && (
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={12} color="#FFB300" />
                        <Text style={styles.ratingBadgeText}>
                          {provider.averageRating.toFixed(1)} ({provider.totalReviews || 0})
                        </Text>
                      </View>
                    )}

                    {provider.baseTown && (
                      <View style={styles.locationBadge}>
                        <Ionicons name="location-outline" size={12} color="#1565C0" />
                        <Text style={styles.locationBadgeText}>{provider.baseTown}</Text>
                      </View>
                    )}

                    {provider.travelAnywhere && (
                      <View style={styles.travelBadge}>
                        <Ionicons name="globe-outline" size={12} color="#1976D2" />
                        <Text style={styles.travelBadgeText}>Willing to travel</Text>
                      </View>
                    )}
                  </View>

                  {/* Away helper text */}
                  {isAway && (
                    <View style={styles.awayHelperContainer}>
                      <Ionicons name="time-outline" size={16} color="#757575" />
                      <Text style={styles.awayHelperText}>Away — not accepting new jobs right now</Text>
                    </View>
                  )}

                  {/* Availability note */}
                  {provider.availabilityNote && !isAway && (
                    <View style={styles.availabilityNoteContainer}>
                      <Ionicons name="time-outline" size={14} color="#666" />
                      <Text style={styles.availabilityNoteText}>{provider.availabilityNote}</Text>
                    </View>
                  )}

                  {provider.bio && (
                    <Text style={styles.providerBio} numberOfLines={2}>
                      {provider.bio}
                    </Text>
                  )}


                  {/* Service chips preview */}
                  {provider.services && provider.services.length > 0 && (
                    <View style={styles.serviceChipsRow}>
                      {provider.services.slice(0, 3).map((svc) => (
                        <View key={svc} style={styles.serviceChipPreview}>
                          <Text style={styles.serviceChipPreviewText}>
                            {svc.charAt(0).toUpperCase() + svc.slice(1)}
                          </Text>
                        </View>
                      ))}
                      {provider.services.length > 3 && (
                        <View style={styles.serviceChipPreview}>
                          <Text style={styles.serviceChipPreviewText}>
                            +{provider.services.length - 3} more
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* View Details - same as provider-list */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.viewDetailsText}>View Details</Text>
                    <Ionicons name="chevron-forward" size={20} color="#C13E1F" />
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Bottom CTA */}
            <View style={styles.bottomCta}>
              <Text style={styles.bottomCtaTitle}>Ready to get started?</Text>
              <Text style={styles.bottomCtaText}>Create a service request to connect with providers.</Text>
              <TouchableOpacity style={styles.createRequestButton} onPress={handleCreateRequest}>
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.createRequestButtonText}>Create Request</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// Styles copied from provider-list.tsx for consistency
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(215, 72, 38, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C13E1F',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backToServicesButton: {
    backgroundColor: '#C13E1F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  backToServicesText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
    gap: 16,
  },
  resultsSummary: {
    paddingVertical: 8,
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
  },
  // Filter & Sort Bar - same as provider-list
  sortFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 0,
    gap: 8,
  },
  filterPillBase: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#C13E1F',
    gap: 4,
    minHeight: 40,
  },
  filterPillActive: {
    backgroundColor: '#C13E1F',
    borderColor: '#C13E1F',
  },
  filterPillText: {
    fontSize: 12,
    color: '#C13E1F',
    fontWeight: '600',
    textAlign: 'center',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  filterStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  filterStatusText: {
    fontSize: 12,
    color: '#666',
  },
  clearFiltersText: {
    fontSize: 12,
    color: '#C13E1F',
    fontWeight: '600',
  },
  // Provider Card - same as provider-list
  providerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  providerHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  providerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  favoriteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  providerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  statusTextVerified: {
    color: '#2E7D32',
  },
  statusTextPending: {
    color: '#4A7DC4',
  },
  // Badges - same as provider-list
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  availableNowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  availableNowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  availableNowBadgeText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  awayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  awayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9E9E9E',
  },
  awayBadgeText: {
    fontSize: 12,
    color: '#757575',
    fontWeight: '500',
  },
  awayHelperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  awayHelperText: {
    fontSize: 13,
    color: '#757575',
    flex: 1,
    lineHeight: 18,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  trustBadgeText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  jobsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  jobsBadgeText: {
    fontSize: 12,
    color: '#1565C0',
    fontWeight: '500',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratingBadgeText: {
    fontSize: 12,
    color: '#F57C00',
    fontWeight: '600',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  locationBadgeText: {
    fontSize: 12,
    color: '#1565C0',
  },
  travelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  travelBadgeText: {
    fontSize: 12,
    color: '#1976D2',
  },
  availabilityNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  availabilityNoteText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  providerBio: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#C13E1F',
    fontWeight: '600',
  },
  // Bottom CTA
  bottomCta: {
    backgroundColor: 'rgba(215, 72, 38, 0.08)',
    borderRadius: 12,
    padding: 20,
    marginTop: 8,
    alignItems: 'center',
  },
  bottomCtaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  bottomCtaText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  createRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C13E1F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  createRequestButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  serviceChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  serviceChipPreview: {
    backgroundColor: '#C13E1F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  serviceChipPreviewText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});
