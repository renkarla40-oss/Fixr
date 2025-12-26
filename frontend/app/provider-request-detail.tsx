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
  isGeneralRequest?: boolean;
  subCategory?: string;
  location?: string;
}

export default function ProviderRequestDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();
  const requestId = params.requestId as string;

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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

  const handleAccept = () => {
    Alert.alert(
      'Accept Request',
      'Are you sure you want to accept this service request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: () => updateRequestStatus('accept'),
        },
      ]
    );
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline Request',
      'Are you sure you want to decline this service request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => updateRequestStatus('decline'),
        },
      ]
    );
  };

  const updateRequestStatus = async (action: 'accept' | 'decline') => {
    if (!request) return;

    setActionLoading(true);
    try {
      await axios.patch(
        `${BACKEND_URL}/api/service-requests/${requestId}/${action}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const statusText = action === 'accept' ? 'accepted' : 'declined';
      Alert.alert(
        'Success',
        `Request has been ${statusText}`,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(provider)/dashboard'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error updating request:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to update request. Please try again.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const categoryNames: { [key: string]: string } = {
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    ac: 'AC Repair',
    cleaning: 'Cleaning',
    handyman: 'Handyman',
    other: 'Other Services (Beta)',
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

  const isPending = request.status === 'pending';

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
          {request.isGeneralRequest ? (
            <View style={styles.generalBanner}>
              <Ionicons name="people" size={20} color="#7C4DFF" />
              <Text style={styles.generalBannerText}>General Request - Open to All Providers</Text>
            </View>
          ) : (
            <View style={styles.urgentBanner}>
              <Ionicons name="alert-circle" size={20} color="#E53935" />
              <Text style={styles.urgentText}>New Service Request</Text>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="construct" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Service</Text>
            </View>
            <Text style={styles.sectionContent}>
              {categoryNames[request.service] || request.service}
            </Text>
          </View>

          {/* Sub-category for Handyman services */}
          {request.subCategory && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="list" size={20} color="#666" />
                <Text style={styles.sectionTitle}>Service Type</Text>
              </View>
              <Text style={styles.sectionContent}>{request.subCategory}</Text>
            </View>
          )}

          {/* Customer Location */}
          {request.location && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="location" size={20} color="#E53935" />
                <Text style={styles.sectionTitle}>Service Location</Text>
              </View>
              <View style={styles.locationBadge}>
                <Text style={styles.locationText}>{request.location}</Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Customer</Text>
            </View>
            <Text style={styles.customerName}>{request.customerName}</Text>
            <TouchableOpacity style={styles.phoneButton}>
              <Ionicons name="call" size={18} color="#E53935" />
              <Text style={styles.phoneText}>{request.customerPhone}</Text>
            </TouchableOpacity>
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

        {isPending && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.declineButton, actionLoading && styles.buttonDisabled]}
              onPress={handleDecline}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator color="#E53935" />
              ) : (
                <>
                  <Ionicons name="close-circle" size={20} color="#E53935" />
                  <Text style={styles.declineButtonText}>Decline</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.acceptButton, actionLoading && styles.buttonDisabled]}
              onPress={handleAccept}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
    paddingBottom: 150,
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF5F5',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    marginBottom: 24,
  },
  urgentText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E53935',
  },
  generalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EDE7F6',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1C4E9',
    marginBottom: 24,
  },
  generalBannerText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#7C4DFF',
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
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  phoneText: {
    fontSize: 16,
    color: '#E53935',
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    alignSelf: 'flex-start',
  },
  locationText: {
    fontSize: 16,
    color: '#E53935',
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E53935',
    minHeight: 56,
  },
  declineButtonText: {
    color: '#E53935',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#E53935',
    minHeight: 56,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
