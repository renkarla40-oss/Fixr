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
            <ActivityIndicator size="large" color="#4A90E2" />
          </View>
        ) : providers.length === 0 ? (
          <View style={styles.centerContent}>
            <Ionicons name="search" size={64} color="#CCC" />
            <Text style={styles.emptyTitle}>No Providers Found</Text>
            <Text style={styles.emptySubtitle}>
              We don't have any {categoryName.toLowerCase()} providers yet.{"\n"}
              Check back soon!
            </Text>
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
                    <Ionicons name="person" size={28} color="#4A90E2" />
                  </View>
                  <View style={styles.providerInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.providerName}>{provider.name}</Text>
                      {provider.verificationStatus === 'verified' && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#4CAF50"
                        />
                      )}
                    </View>
                    <View style={styles.servicesContainer}>
                      {provider.services.slice(0, 3).map((service, index) => (
                        <View key={index} style={styles.serviceBadge}>
                          <Text style={styles.serviceBadgeText}>
                            {service.charAt(0).toUpperCase() + service.slice(1)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
                {provider.bio && (
                  <Text style={styles.providerBio} numberOfLines={2}>
                    {provider.bio}
                  </Text>
                )}
                <View style={styles.cardFooter}>
                  <Text style={styles.viewDetailsText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={20} color="#4A90E2" />
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
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  providerHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F7FF',
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
    gap: 6,
    marginBottom: 8,
  },
  providerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  serviceBadge: {
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  serviceBadgeText: {
    fontSize: 12,
    color: '#4A90E2',
    fontWeight: '600',
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
    color: '#4A90E2',
    fontWeight: '600',
  },
});