import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Provider {
  _id: string;
  name: string;
  services: string[];
  bio: string;
  verificationStatus: string;
}

export default function ProviderListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();
  const categoryId = params.category as string;
  const categoryName = params.categoryName as string;

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProviders();
  }, [categoryId]);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/providers`, {
        params: { service: categoryId },
        headers: { Authorization: `Bearer ${token}` },
      });
      setProviders(response.data);
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderPress = (providerId: string) => {
    router.push({
      pathname: '/provider-detail',
      params: { providerId, category: categoryId },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.title}>{categoryName}</Text>
          <View style={styles.backButton} />
        </View>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#E53935" />
          </View>
        ) : providers.length === 0 ? (
          <View style={styles.centerContent}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="people-outline" size={48} color="#E53935" />
            </View>
            <Text style={styles.emptyTitle}>No {categoryName} Providers Yet</Text>
            <Text style={styles.emptySubtitle}>
              We're actively onboarding verified {categoryName.toLowerCase()} professionals in your area.
            </Text>
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
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {providers.map((provider) => (
              <TouchableOpacity
                key={provider._id}
                style={styles.providerCard}
                onPress={() => handleProviderPress(provider._id)}
                activeOpacity={0.7}
              >
                <View style={styles.providerHeader}>
                  <View style={styles.avatarContainer}>
                    <Ionicons name="person" size={24} color="#666" />
                  </View>
                  <View style={styles.providerInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.providerName}>{provider.name}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          provider.verificationStatus === 'verified'
                            ? styles.statusVerified
                            : styles.statusPending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            provider.verificationStatus === 'verified'
                              ? styles.statusTextVerified
                              : styles.statusTextPending,
                          ]}
                        >
                          {provider.verificationStatus === 'verified'
                            ? 'Verified'
                            : 'Pending'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.categoryText}>
                      {categoryName}
                    </Text>
                  </View>
                </View>
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
    </SafeAreaView>
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
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
  },
  providerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  providerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusVerified: {
    backgroundColor: '#E8F5E9',
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextVerified: {
    color: '#2E7D32',
  },
  statusTextPending: {
    color: '#F57C00',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
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
});