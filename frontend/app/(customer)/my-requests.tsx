import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface ServiceRequest {
  _id: string;
  service: string;
  description: string;
  providerName: string;
  status: string;
  createdAt: string;
  preferredDateTime?: string;
  subCategory?: string;
  location?: string;
}

export default function MyRequestsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(response.data);
    } catch (error) {
      // Silent fail for list fetching - don't show error to user
      // Just log for debugging in dev mode
      if (__DEV__) {
        console.warn('Error fetching requests:', error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const handleRequestPress = (requestId: string) => {
    router.push({
      pathname: '/request-detail',
      params: { requestId },
    });
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
        return { bg: '#E8F5E9', text: '#2E7D32' };
      case 'in_progress':
      case 'started':
        return { bg: '#EEF6FF', text: '#2C5AA0' };
      case 'declined':
        return { bg: '#FFEBEE', text: '#C62828' };
      case 'completed':
        return { bg: '#F3E5F5', text: '#7B1FA2' };
      case 'cancelled':
        return { bg: '#FFF3E0', text: '#E65100' };
      default:
        return { bg: '#EAF3FF', text: '#4A7DC4' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'accepted': return 'Accepted';
      case 'in_progress': return 'In Progress';
      case 'started': return 'In Progress';
      case 'completed': return 'Completed';
      case 'declined': return 'Declined';
      case 'cancelled': return 'Cancelled';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>My Requests</Text>
          </View>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#E53935" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (requests.length === 0) {
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
            <Text style={styles.emptyTitle}>No Service Requests</Text>
            <Text style={styles.emptySubtitle}>
              When you request services from providers,
              {"\n"}they'll appear here.
            </Text>
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
            const statusColors = getStatusColor(request.status);
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
                      {getStatusLabel(request.status)}
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
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    gap: 6,
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subCategoryText: {
    fontSize: 13,
    color: '#E53935',
    fontWeight: '500',
    marginBottom: 4,
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
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
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
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
});