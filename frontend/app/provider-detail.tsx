import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Provider {
  _id: string;
  name: string;
  phone: string;
  services: string[];
  bio: string;
  verificationStatus: string;
}

export default function ProviderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();
  const providerId = params.providerId as string;
  const category = params.category as string;
  const subCategory = params.subCategory as string | undefined;
  const location = params.location as string | undefined;

  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    fetchProvider();
  }, [providerId]);

  const fetchProvider = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${BACKEND_URL}/api/providers/${providerId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setProvider(response.data);
    } catch (error) {
      if (__DEV__) {
        console.warn('Error fetching provider:', error);
      }
      // Silent fail - will show empty state
    } finally {
      setLoading(false);
    }
  };

  const handleRequestService = () => {
    router.push({
      pathname: '/request-service',
      params: { 
        providerId, 
        category,
        subCategory: subCategory || '',
        location: location || '',
      },
    });
  };

  const handleReportProvider = () => {
    if (!provider) return;
    
    Alert.alert(
      'Report Provider',
      `Are you sure you want to report ${provider.name}? This will be reviewed by our support team.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: submitReport,
        },
      ]
    );
  };

  const submitReport = async () => {
    if (!provider) return;
    
    setReporting(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/feedback`,
        {
          type: 'report',
          subject: 'Provider Report',
          message: `User reported provider: ${provider.name}`,
          providerId: provider._id,
          providerName: provider.name,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      Alert.alert(
        'Report Submitted',
        'Thank you for your report. Our team will review it and take appropriate action.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setReporting(false);
    }
  };

  if (loading) {
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
            <Text style={styles.title}>Provider Details</Text>
            <View style={styles.backButton} />
          </View>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#E53935" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!provider) {
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
            <Text style={styles.title}>Provider Details</Text>
            <View style={styles.backButton} />
          </View>
          <View style={styles.centerContent}>
            <Text style={styles.errorText}>Provider not found</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.title}>Provider Details</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileSection}>
            <View style={styles.avatarLarge}>
              <Ionicons name="person" size={64} color="#666" />
            </View>
            <View style={styles.nameContainer}>
              <Text style={styles.providerName}>{provider.name}</Text>
              <View
                style={[
                  styles.verificationBadge,
                  provider.verificationStatus === 'verified'
                    ? styles.verifiedBadge
                    : styles.pendingBadge,
                ]}
              >
                <Ionicons
                  name={
                    provider.verificationStatus === 'verified'
                      ? 'checkmark-circle'
                      : 'time'
                  }
                  size={16}
                  color={
                    provider.verificationStatus === 'verified'
                      ? '#2E7D32'
                      : '#4A7DC4'
                  }
                />
                <Text
                  style={[
                    styles.verificationText,
                    provider.verificationStatus === 'verified'
                      ? styles.verifiedText
                      : styles.pendingText,
                  ]}
                >
                  {provider.verificationStatus === 'verified'
                    ? 'Verified'
                    : 'Pending Verification'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="construct" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Services Offered</Text>
            </View>
            <View style={styles.servicesGrid}>
              {provider.services.map((service, index) => (
                <View key={index} style={styles.serviceChip}>
                  <Text style={styles.serviceChipText}>
                    {service.charAt(0).toUpperCase() + service.slice(1)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {provider.bio && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="information-circle" size={20} color="#666" />
                <Text style={styles.sectionTitle}>About</Text>
              </View>
              <Text style={styles.bioText}>{provider.bio}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.reportButton}
            onPress={handleReportProvider}
            disabled={reporting}
            activeOpacity={0.7}
          >
            <Ionicons name="flag-outline" size={18} color="#999" />
            <Text style={styles.reportButtonText}>
              {reporting ? 'Submitting...' : 'Report this provider'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.requestButton}
            onPress={handleRequestService}
            activeOpacity={0.8}
          >
            <Text style={styles.requestButtonText}>Request Service</Text>
          </TouchableOpacity>
        </View>
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
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 100,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  nameContainer: {
    alignItems: 'center',
    gap: 8,
  },
  providerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  verifiedBadge: {
    backgroundColor: '#E8F5E9',
  },
  pendingBadge: {
    backgroundColor: '#EAF3FF',
  },
  verificationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  verifiedText: {
    color: '#2E7D32',
  },
  pendingText: {
    color: '#4A7DC4',
  },
  section: {
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceChip: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  serviceChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  bioText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  requestButton: {
    backgroundColor: '#E53935',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  requestButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    marginTop: 16,
  },
  reportButtonText: {
    fontSize: 14,
    color: '#999',
  },
});