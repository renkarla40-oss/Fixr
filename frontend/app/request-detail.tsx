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

interface ServiceRequest {
  _id: string;
  service: string;
  description: string;
  providerName: string;
  customerName: string;
  customerPhone: string;
  status: string;
  createdAt: string;
  preferredDateTime?: string;
}

export default function RequestDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();
  const requestId = params.requestId as string;

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequestDetail();
  }, [requestId]);

  const fetchRequestDetail = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allRequests = response.data;
      const foundRequest = allRequests.find((r: any) => r._id === requestId);
      setRequest(foundRequest || null);
    } catch (error) {
      console.error('Error fetching request detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const categoryNames: { [key: string]: string } = {
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    ac: 'AC Repair',
    cleaning: 'Cleaning',
    handyman: 'Handyman',
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return { bg: '#E8F5E9', text: '#2E7D32', icon: 'checkmark-circle' };
      case 'declined':
        return { bg: '#FFEBEE', text: '#C62828', icon: 'close-circle' };
      default:
        return { bg: '#FFF3E0', text: '#F57C00', icon: 'time' };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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
            <Text style={styles.title}>Request Details</Text>
            <View style={styles.backButton} />
          </View>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#E53935" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!request) {
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
            <Text style={styles.title}>Request Details</Text>
            <View style={styles.backButton} />
          </View>
          <View style={styles.centerContent}>
            <Text style={styles.errorText}>Request not found</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const statusColors = getStatusColor(request.status);

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
          <Text style={styles.title}>Request Details</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.statusSection,
              { backgroundColor: statusColors.bg },
            ]}
          >
            <Ionicons
              name={statusColors.icon as any}
              size={48}
              color={statusColors.text}
            />
            <Text style={[styles.statusLabel, { color: statusColors.text }]}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="construct" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Service</Text>
            </View>
            <Text style={styles.sectionContent}>
              {categoryNames[request.service] || request.service}
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Provider</Text>
            </View>
            <Text style={styles.sectionContent}>{request.providerName}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Description</Text>
            </View>
            <Text style={styles.descriptionText}>{request.description}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Preferred Date & Time</Text>
            </View>
            <Text style={styles.sectionContent}>
              {formatDateTime(request.preferredDateTime)}
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Requested On</Text>
            </View>
            <Text style={styles.sectionContent}>
              {formatDate(request.createdAt)}
            </Text>
          </View>
        </ScrollView>
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
  },
  statusSection: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    marginBottom: 24,
  },
  statusLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
  },
  section: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    fontSize: 18,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  descriptionText: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
  },
});