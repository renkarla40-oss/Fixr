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
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../contexts/FavoritesContext';
import { getServiceLabel } from '../../constants/serviceCategories';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Provider {
  _id: string;
  name: string;
  services: string[];
  bio?: string;
  profilePhotoUrl?: string;
  verificationStatus: string;
  availabilityStatus?: string;
  averageRating?: number;
  totalReviews?: number;
  completedJobsCount?: number;
}

// Sort options
type SortOption = 'default' | 'rating' | 'jobs';
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'jobs', label: 'Most Jobs' },
];

export default function ProviderDirectoryScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const insets = useSafeAreaInsets();

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available'>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Fetch all providers
  const fetchProviders = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/providers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProviders(response.data || []);
    } catch (err) {
      console.log('[Directory] Failed to fetch providers:', err);
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

  // Filter and sort providers
  const filteredProviders = useMemo(() => {
    let result = [...providers];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.services.some(s => getServiceLabel(s).toLowerCase().includes(query))
      );
    }
    
    // Availability filter
    if (availabilityFilter === 'available') {
      result = result.filter(p => p.availabilityStatus !== 'away');
    }
    
    // Verified filter
    if (verifiedOnly) {
      result = result.filter(p => p.verificationStatus === 'verified');
    }
    
    // Sort
    switch (sortBy) {
      case 'rating':
        result.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
        break;
      case 'jobs':
        result.sort((a, b) => (b.completedJobsCount || 0) - (a.completedJobsCount || 0));
        break;
    }
    
    return result;
  }, [providers, searchQuery, sortBy, availabilityFilter, verifiedOnly]);

  // Handle provider card press - view profile only (no request)
  const handleProviderPress = (providerId: string, isAway: boolean) => {
    if (isAway) {
      Alert.alert(
        'Provider Unavailable',
        'This provider is currently away. You can still view their profile.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Profile', onPress: () => navigateToProfile(providerId) },
        ]
      );
      return;
    }
    navigateToProfile(providerId);
  };

  const navigateToProfile = (providerId: string) => {
    // Navigate WITHOUT requestId - this signals directory browsing mode
    router.push({
      pathname: '/provider-detail',
      params: { 
        providerId,
        fromDirectory: 'true', // Signal that this is from directory
      },
    });
  };

  // Handle "Create Request" CTA
  const handleCreateRequest = () => {
    router.push('/(customer)/home');
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#E53935" />
        <Text style={styles.loadingText}>Loading providers...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.title}>Provider Directory</Text>
        <View style={styles.backButton} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or service..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterPill, sortBy !== 'default' && styles.filterPillActive]}
          onPress={() => {
            const currentIndex = SORT_OPTIONS.findIndex(o => o.value === sortBy);
            const nextIndex = (currentIndex + 1) % SORT_OPTIONS.length;
            setSortBy(SORT_OPTIONS[nextIndex].value);
          }}
        >
          <Ionicons name="swap-vertical" size={14} color={sortBy !== 'default' ? '#FFFFFF' : '#E53935'} />
          <Text style={[styles.filterPillText, sortBy !== 'default' && styles.filterPillTextActive]} numberOfLines={1}>
            {SORT_OPTIONS.find(o => o.value === sortBy)?.label}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, availabilityFilter === 'available' && styles.filterPillActive]}
          onPress={() => setAvailabilityFilter(availabilityFilter === 'all' ? 'available' : 'all')}
        >
          <Text style={[styles.filterPillText, availabilityFilter === 'available' && styles.filterPillTextActive]} numberOfLines={1}>
            {availabilityFilter === 'all' ? 'All' : 'Available'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, verifiedOnly && styles.filterPillActive]}
          onPress={() => setVerifiedOnly(!verifiedOnly)}
        >
          <Ionicons name="checkmark-circle" size={14} color={verifiedOnly ? '#FFFFFF' : '#E53935'} />
          <Text style={[styles.filterPillText, verifiedOnly && styles.filterPillTextActive]} numberOfLines={1}>
            Verified
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results Count */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsText}>
          {filteredProviders.length} provider{filteredProviders.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Provider List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#E53935" />
        }
      >
        {filteredProviders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color="#CCC" />
            <Text style={styles.emptyTitle}>No providers found</Text>
            <Text style={styles.emptyText}>Try adjusting your filters or search terms.</Text>
          </View>
        ) : (
          filteredProviders.map((provider) => {
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
                            : provider.profilePhotoUrl 
                        }}
                        style={styles.avatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="person" size={24} color="#666" />
                    )}
                  </View>
                  <View style={styles.providerInfo}>
                    <Text style={styles.providerName}>{provider.name}</Text>
                    <View style={styles.statusRow}>
                      <Ionicons
                        name={provider.verificationStatus === 'verified' ? 'checkmark-circle' : 'time-outline'}
                        size={14}
                        color={provider.verificationStatus === 'verified' ? '#2E7D32' : '#4A7DC4'}
                      />
                      <Text style={[
                        styles.statusText,
                        provider.verificationStatus === 'verified' ? styles.statusVerified : styles.statusPending
                      ]}>
                        {provider.verificationStatus === 'verified' ? 'Verified' : 'Pending'}
                      </Text>
                      {isAway && (
                        <View style={styles.awayBadge}>
                          <View style={styles.awayDot} />
                          <Text style={styles.awayText}>Away</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.favoriteButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleFavorite(provider._id);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={favorited ? 'heart' : 'heart-outline'}
                      size={22}
                      color={favorited ? '#E53935' : '#999'}
                    />
                  </TouchableOpacity>
                </View>

                {/* Services */}
                <View style={styles.servicesRow}>
                  {provider.services.slice(0, 3).map((service, idx) => (
                    <View key={idx} style={styles.serviceBadge}>
                      <Text style={styles.serviceBadgeText}>{getServiceLabel(service)}</Text>
                    </View>
                  ))}
                  {provider.services.length > 3 && (
                    <Text style={styles.moreServices}>+{provider.services.length - 3} more</Text>
                  )}
                </View>

                {/* Rating and Jobs */}
                <View style={styles.statsRow}>
                  {provider.averageRating && provider.totalReviews ? (
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={14} color="#FFC107" />
                      <Text style={styles.ratingText}>
                        {provider.averageRating.toFixed(1)} ({provider.totalReviews})
                      </Text>
                    </View>
                  ) : null}
                  {provider.completedJobsCount ? (
                    <View style={styles.jobsContainer}>
                      <Ionicons name="briefcase-outline" size={14} color="#666" />
                      <Text style={styles.jobsText}>{provider.completedJobsCount} jobs</Text>
                    </View>
                  ) : null}
                </View>

                {/* View Profile Button */}
                <View style={styles.cardFooter}>
                  <Text style={styles.viewProfileText}>View Profile →</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E53935',
    gap: 4,
  },
  filterPillActive: {
    backgroundColor: '#E53935',
  },
  filterPillText: {
    fontSize: 12,
    color: '#E53935',
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  resultsBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  resultsText: {
    fontSize: 13,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
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
  },
  providerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
  },
  statusVerified: {
    color: '#2E7D32',
  },
  statusPending: {
    color: '#4A7DC4',
  },
  awayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  awayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF9800',
    marginRight: 4,
  },
  awayText: {
    fontSize: 10,
    color: '#E65100',
    fontWeight: '600',
  },
  favoriteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 6,
  },
  serviceBadge: {
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  serviceBadgeText: {
    fontSize: 11,
    color: '#E53935',
    fontWeight: '500',
  },
  moreServices: {
    fontSize: 11,
    color: '#666',
    alignSelf: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    color: '#666',
  },
  jobsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobsText: {
    fontSize: 13,
    color: '#666',
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  viewProfileText: {
    fontSize: 14,
    color: '#E53935',
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomCta: {
    backgroundColor: '#FFF5F5',
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
    backgroundColor: '#E53935',
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
});
