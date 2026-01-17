import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getServiceLabel } from '../constants/serviceCategories';
import { kmToMiles } from '../constants/distanceUtils';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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
  availabilityStatus?: string;  // "available" | "away"
  availabilityNote?: string;
  profilePhotoUrl?: string;
  // Trust badges (Phase 4)
  phoneVerified?: boolean;
  uploadsComplete?: boolean;
  completedJobsCount?: number;
  averageRating?: number;
  totalReviews?: number;
}

export default function ProviderListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Extract params with clear variable names
  const categoryId = params.category as string;
  const categoryName = params.categoryName as string;
  const subCategory = params.subCategory as string | undefined;
  const subcategoryKey = params.subcategoryKey as string | undefined;
  const location = params.location as string | undefined;
  // Use searchDistanceKm consistently
  const searchDistanceKm = params.searchDistanceKm 
    ? parseInt(params.searchDistanceKm as string) 
    : 16; // Default 16km (~10 miles)
  const jobDuration = params.jobDuration as string | undefined;
  
  // Check if this is the "Other Services (Beta)" category
  const isOtherCategory = categoryId === 'other';

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeTravelAnywhere, setIncludeTravelAnywhere] = useState(false); // Default OFF
  const [showNoProvidersModal, setShowNoProvidersModal] = useState(false);
  const [initialSearchComplete, setInitialSearchComplete] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders(false); // Initial fetch with travel-anywhere OFF
  }, [categoryId, location, searchDistanceKm]);

  useEffect(() => {
    if (initialSearchComplete) {
      fetchProviders(includeTravelAnywhere);
    }
  }, [includeTravelAnywhere]);

  const fetchProviders = async (includeTravel: boolean) => {
    try {
      setLoading(true);
      setFetchError(null); // Clear any previous errors
      
      const response = await axios.get(`${BACKEND_URL}/api/providers`, {
        params: { 
          service: categoryId,
          job_town: location,
          search_radius: searchDistanceKm,
          include_travel_anywhere: includeTravel,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Valid response - set providers (can be empty array, that's fine)
      setProviders(response.data);
      
      // MVP MODE: Location filtering disabled - modal never shows
      // Flow always proceeds to Available Providers list
      if (!initialSearchComplete) {
        setInitialSearchComplete(true);
        // Modal disabled for MVP - all providers shown regardless of location
      }
    } catch (error: any) {
      // Only log and show error for actual failures (network errors, 4xx/5xx)
      // Use console.warn instead of console.error to avoid Expo's error toast
      if (__DEV__) {
        console.warn('Provider fetch failed:', error?.message || 'Unknown error');
      }
      
      // Set user-friendly error message
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        setFetchError('Please sign in to view providers.');
      } else if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network')) {
        setFetchError('Unable to connect. Please check your internet connection.');
      } else {
        setFetchError('Unable to load providers. Please try again.');
      }
      
      // Keep providers empty on error
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderPress = (providerId: string) => {
    router.push({
      pathname: '/provider-detail',
      params: { 
        providerId, 
        category: categoryId,
        subCategory: subCategory || '',
        location: location || '',
        searchDistanceKm: searchDistanceKm.toString(),
        jobDuration: jobDuration || '',
      },
    });
  };

  const handleSubmitGeneralRequest = () => {
    router.push({
      pathname: '/request-service',
      params: { 
        providerId: 'general', 
        category: 'other',
        subCategory: subCategory || '',
        location: location || '',
      },
    });
  };

  const handleExpandSearch = () => {
    setShowNoProvidersModal(false);
    setIncludeTravelAnywhere(true);
  };

  const displayName = categoryName || getServiceLabel(categoryId) || 'Services';

  // Count providers in each bucket for display
  const localProviders = providers.filter(p => !p.isOutsideSelectedArea);
  const travelAnywhereProviders = providers.filter(p => p.isOutsideSelectedArea);

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.title}>{displayName}</Text>
          <View style={styles.backButton} />
        </View>

        {/* Location & Filter Bar */}
        {location && (
          <View style={styles.filterBar}>
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={16} color="#E53935" />
              <Text style={styles.locationText}>{location}</Text>
              <Text style={styles.radiusText}>({searchDistanceKm} km)</Text>
            </View>
            
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Include travel providers</Text>
              <Switch
                value={includeTravelAnywhere}
                onValueChange={setIncludeTravelAnywhere}
                trackColor={{ false: '#E0E0E0', true: '#FFCDD2' }}
                thumbColor={includeTravelAnywhere ? '#E53935' : '#f4f3f4'}
              />
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#E53935" />
          </View>
        ) : fetchError ? (
          // Show error state for actual API failures
          <View style={styles.centerContent}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="cloud-offline-outline" size={48} color="#E53935" />
            </View>
            <Text style={styles.emptyTitle}>Something Went Wrong</Text>
            <Text style={styles.emptySubtitle}>{fetchError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchProviders(includeTravelAnywhere)}
            >
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : providers.length === 0 ? (
          // Show empty state for valid results with no providers (NOT an error)
          <View style={styles.centerContent}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="people-outline" size={48} color="#E53935" />
            </View>
            <Text style={styles.emptyTitle}>
              No {displayName} Providers Yet
            </Text>
            <Text style={styles.emptySubtitle}>
              {isOtherCategory 
                ? "This is a beta category. You can still submit a request and we'll try to match you with an available provider."
                : location 
                  ? `We couldn't find any providers within ${searchDistanceKm} km of ${location}.`
                  : `We're actively onboarding verified ${(categoryName || 'service').toLowerCase()} professionals in your area.`}
            </Text>
            {isOtherCategory ? (
              <TouchableOpacity
                style={styles.submitRequestButton}
                onPress={handleSubmitGeneralRequest}
              >
                <Text style={styles.submitRequestText}>Submit a General Request</Text>
              </TouchableOpacity>
            ) : (
              <View>
                {location && !includeTravelAnywhere && (
                  <TouchableOpacity
                    style={styles.expandSearchButton}
                    onPress={() => setIncludeTravelAnywhere(true)}
                  >
                    <Ionicons name="globe-outline" size={20} color="#E53935" />
                    <Text style={styles.expandSearchText}>Include providers willing to travel</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.emptyHint}>
                  Check back soon or try another service category.
                </Text>
                <TouchableOpacity
                  style={styles.backToServicesButton}
                  onPress={() => router.back()}
                >
                  <Text style={styles.backToServicesText}>Browse Other Services</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Results summary */}
            {location && (
              <View style={styles.resultsSummary}>
                <Text style={styles.resultsText}>
                  {localProviders.length} provider{localProviders.length !== 1 ? 's' : ''} in your area
                  {includeTravelAnywhere && travelAnywhereProviders.length > 0 && (
                    <Text style={styles.travelResultsText}>
                      {' '}+ {travelAnywhereProviders.length} willing to travel
                    </Text>
                  )}
                </Text>
              </View>
            )}

            {providers.map((provider) => (
              <TouchableOpacity
                key={provider._id}
                style={styles.providerCard}
                onPress={() => handleProviderPress(provider._id)}
                activeOpacity={0.7}
              >
                <View style={styles.providerHeader}>
                  <View style={styles.avatarContainer}>
                    {provider.profilePhotoUrl ? (
                      <Image
                        source={{ uri: provider.profilePhotoUrl.startsWith('/') ? `${BACKEND_URL}${provider.profilePhotoUrl}` : provider.profilePhotoUrl }}
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
                        {provider.verificationStatus === 'verified'
                          ? 'Verified Provider'
                          : 'Verification Pending'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Badges */}
                <View style={styles.badgeContainer}>
                  {/* Trust Badges - Phase 4 (Positive framing only) */}
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
                  
                  {/* Availability status badge - Phase 3A */}
                  {provider.isAcceptingJobs !== false ? (
                    <View style={styles.acceptingBadge}>
                      <View style={styles.acceptingDot} />
                      <Text style={styles.acceptingBadgeText}>Accepting jobs</Text>
                    </View>
                  ) : (
                    <View style={styles.unavailableBadge}>
                      <View style={styles.unavailableDot} />
                      <Text style={styles.unavailableBadgeText}>Unavailable</Text>
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
                  
                  {provider.isOutsideSelectedArea && (
                    <View style={styles.outsideAreaBadge}>
                      <Ionicons name="car-outline" size={12} color="#4A7DC4" />
                      <Text style={styles.outsideAreaBadgeText}>Outside selected area</Text>
                    </View>
                  )}
                  
                  {provider.distanceFromJob !== undefined && provider.distanceFromJob !== null && !provider.isOutsideSelectedArea && (
                    <View style={styles.distanceBadge}>
                      <Ionicons name="navigate-outline" size={12} color="#1565C0" />
                      <Text style={styles.distanceBadgeText}>~{provider.distanceFromJob} km away</Text>
                    </View>
                  )}
                </View>

                {/* Availability note - Phase 3A */}
                {provider.availabilityNote && (
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
                <View style={styles.cardFooter}>
                  <Text style={styles.viewDetailsText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={20} color="#E53935" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* No Providers Modal */}
      <Modal
        visible={showNoProvidersModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowNoProvidersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="search-outline" size={48} color="#E53935" />
            </View>
            
            <Text style={styles.modalTitle}>No Local Providers Found</Text>
            <Text style={styles.modalMessage}>
              We couldn't find any {displayName.toLowerCase()} providers within {searchDistanceKm} km of {location}.
            </Text>
            
            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={handleExpandSearch}
              >
                <Ionicons name="globe-outline" size={20} color="#FFFFFF" />
                <Text style={styles.modalPrimaryButtonText}>Include providers willing to travel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => {
                  setShowNoProvidersModal(false);
                  router.back();
                }}
              >
                <Text style={styles.modalSecondaryButtonText}>Change location or radius</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalTertiaryButton}
                onPress={() => setShowNoProvidersModal(false)}
              >
                <Text style={styles.modalTertiaryButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  radiusText: {
    fontSize: 13,
    color: '#666',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#FFF5F5',
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
  emptyHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
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
  expandSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E53935',
    marginBottom: 16,
    gap: 8,
  },
  expandSearchText: {
    color: '#E53935',
    fontSize: 14,
    fontWeight: '600',
  },
  backToServicesButton: {
    backgroundColor: '#E53935',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backToServicesText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitRequestButton: {
    backgroundColor: '#E53935',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  submitRequestText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  resultsSummary: {
    paddingVertical: 8,
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
  },
  travelResultsText: {
    color: '#1976D2',
  },
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
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  // Availability badges - Phase 3A
  acceptingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  acceptingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  acceptingBadgeText: {
    fontSize: 12,
    color: '#2E7D32',
  },
  unavailableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  unavailableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9E9E9E',
  },
  unavailableBadgeText: {
    fontSize: 12,
    color: '#757575',
  },
  // Trust badges - Phase 4 (Positive framing)
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
  outsideAreaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF3FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  outsideAreaBadgeText: {
    fontSize: 12,
    color: '#4A7DC4',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  distanceBadgeText: {
    fontSize: 12,
    color: '#1565C0',
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
    color: '#E53935',
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalOptions: {
    gap: 12,
  },
  modalPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSecondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalSecondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  modalTertiaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  modalTertiaryButtonText: {
    color: '#999',
    fontSize: 14,
  },
});
