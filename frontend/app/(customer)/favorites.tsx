import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFavorites } from '../../contexts/FavoritesContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface FavoriteProvider {
  _id: string;
  name: string;
  profilePhotoUrl?: string;
  services: string[];
  bio: string;
  verificationStatus: string;
  averageRating?: number;
  totalReviews?: number;
  availabilityStatus?: string;
}

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { favoriteProviders, loading, refreshFavorites, toggleFavorite, isFavorite } = useFavorites();

  const renderProvider = ({ item }: { item: FavoriteProvider }) => {
    const isAway = item.availabilityStatus === 'away';
    const favorited = isFavorite(item._id);
    
    return (
      <TouchableOpacity
        style={styles.providerCard}
        onPress={() => router.push({
          pathname: '/provider-detail',
          params: { providerId: item._id },
        })}
        activeOpacity={0.7}
      >
        <View style={styles.providerHeader}>
          <View style={styles.avatarContainer}>
            {item.profilePhotoUrl ? (
              <Image
                source={{ 
                  uri: item.profilePhotoUrl.startsWith('/') 
                    ? `${BACKEND_URL}${item.profilePhotoUrl}` 
                    : item.profilePhotoUrl 
                }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person" size={24} color="#666" />
            )}
          </View>
          <View style={styles.providerInfo}>
            <Text style={styles.providerName}>{item.name}</Text>
            <View style={styles.statusRow}>
              <Ionicons 
                name={item.verificationStatus === 'verified' ? 'checkmark-circle' : 'time-outline'} 
                size={14} 
                color={item.verificationStatus === 'verified' ? '#2E7D32' : '#4A7DC4'} 
              />
              <Text style={[
                styles.statusText,
                item.verificationStatus === 'verified' ? styles.statusTextVerified : styles.statusTextPending
              ]}>
                {item.verificationStatus === 'verified' ? 'Verified' : 'Pending'}
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
              toggleFavorite(item._id);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons 
              name={favorited ? "heart" : "heart-outline"} 
              size={22} 
              color={favorited ? "#E53935" : "#999"} 
            />
          </TouchableOpacity>
        </View>
        
        {item.bio ? (
          <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text>
        ) : null}
        
        {item.averageRating && item.totalReviews && item.totalReviews > 0 ? (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#FFC107" />
            <Text style={styles.ratingText}>
              {item.averageRating.toFixed(1)} ({item.totalReviews} review{item.totalReviews !== 1 ? 's' : ''})
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Favourite Providers</Text>
      </View>

      {loading && favoriteProviders.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#E53935" />
        </View>
      ) : favoriteProviders.length === 0 ? (
        <View style={styles.centerContent}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="heart-outline" size={48} color="#E53935" />
          </View>
          <Text style={styles.emptyTitle}>No Favourites Yet</Text>
          <Text style={styles.emptyText}>
            Tap the heart icon on any provider to add them to your favourites.
          </Text>
        </View>
      ) : (
        <FlatList
          data={favoriteProviders}
          renderItem={renderProvider}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refreshFavorites}
              tintColor="#E53935"
            />
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
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
  statusTextVerified: {
    color: '#2E7D32',
  },
  statusTextPending: {
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
  bio: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    lineHeight: 18,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
  },
});
