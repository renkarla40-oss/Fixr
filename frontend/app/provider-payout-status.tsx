import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface PayoutInfo {
  exists: boolean;
  amount?: number;
  currency?: string;
  status?: string;
  releasedAt?: string;
  message?: string;
}

interface JobInfo {
  service?: string;
  subCategory?: string;
  location?: string;
  description?: string;
}

export default function ProviderPayoutStatusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const requestId = params.requestId as string;

  const [loading, setLoading] = useState(true);
  const [payoutInfo, setPayoutInfo] = useState<PayoutInfo | null>(null);
  const [jobInfo, setJobInfo] = useState<JobInfo | null>(null);

  useEffect(() => {
    if (requestId && token) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [requestId, token]);

  const fetchData = async () => {
    try {
      // Fetch job info
      const jobResponse = await axios.get(
        `${BACKEND_URL}/api/service-requests/${requestId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setJobInfo({
        service: jobResponse.data.service,
        subCategory: jobResponse.data.subCategory,
        location: jobResponse.data.location,
        description: jobResponse.data.description,
      });

      // Fetch payout info
      const payoutResponse = await axios.get(
        `${BACKEND_URL}/api/payouts/by-request/${requestId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPayoutInfo(payoutResponse.data);
    } catch (err: any) {
      console.log('Error fetching payout data:', err);
      // Set fallback state
      setPayoutInfo({
        exists: false,
        message: 'Payout information will appear here once available.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    router.replace({ pathname: '/provider-request-detail', params: { requestId } });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'released':
        return { bg: '#E8F5E9', text: '#2E7D32' };
      case 'on_hold':
        return { bg: '#FFF3E0', text: '#E65100' };
      case 'pending':
      default:
        return { bg: '#FFF3E0', text: '#E65100' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'released':
        return 'Released';
      case 'on_hold':
        return 'On Hold';
      case 'pending':
      default:
        return 'Pending';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading payout status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleDone}>
          <Ionicons name="close" size={28} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payout Status</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="wallet" size={48} color="#4CAF50" />
          </View>
        </View>

        {/* Job Reference */}
        {jobInfo && (
          <View style={styles.jobReference}>
            <Text style={styles.jobReferenceLabel}>Job Reference</Text>
            <Text style={styles.jobReferenceText}>
              {jobInfo.service}{jobInfo.subCategory ? ` - ${jobInfo.subCategory}` : ''}
            </Text>
            {jobInfo.location && (
              <Text style={styles.jobLocationText}>
                <Ionicons name="location-outline" size={14} color="#666" /> {jobInfo.location}
              </Text>
            )}
          </View>
        )}

        {/* Payout Card */}
        {payoutInfo && payoutInfo.exists ? (
          <View style={styles.payoutCard}>
            {/* Amount */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Payout Amount</Text>
              <Text style={styles.amountValue}>
                {payoutInfo.currency || 'TTD'} ${payoutInfo.amount?.toFixed(2)}
              </Text>
            </View>

            {/* Status */}
            <View style={styles.statusSection}>
              <Text style={styles.statusLabel}>Status</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(payoutInfo.status || 'pending').bg }
              ]}>
                <Ionicons 
                  name={payoutInfo.status === 'released' ? 'checkmark-circle' : 'time'} 
                  size={16} 
                  color={getStatusColor(payoutInfo.status || 'pending').text} 
                />
                <Text style={[
                  styles.statusText,
                  { color: getStatusColor(payoutInfo.status || 'pending').text }
                ]}>
                  {getStatusLabel(payoutInfo.status || 'pending')}
                </Text>
              </View>
            </View>

            {/* Released At (only if released) */}
            {payoutInfo.status === 'released' && payoutInfo.releasedAt && (
              <View style={styles.releasedSection}>
                <Text style={styles.releasedLabel}>Released At</Text>
                <Text style={styles.releasedValue}>{formatDateTime(payoutInfo.releasedAt)}</Text>
              </View>
            )}

            {/* Helper Text */}
            <View style={styles.helperSection}>
              <Ionicons name="information-circle-outline" size={20} color="#558B2F" />
              <Text style={styles.helperText}>
                Your payment is on the way now that the job is complete.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.noPayoutCard}>
            <Ionicons name="hourglass-outline" size={40} color="#999" />
            <Text style={styles.noPayoutText}>
              {payoutInfo?.message || 'Payout information will appear here once available.'}
            </Text>
          </View>
        )}
      </View>

      {/* Done Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobReference: {
    alignItems: 'center',
    marginBottom: 24,
  },
  jobReferenceLabel: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  jobReferenceText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  jobLocationText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  payoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  amountSection: {
    alignItems: 'center',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F5E9',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#2E7D32',
  },
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  releasedSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  releasedLabel: {
    fontSize: 14,
    color: '#666',
  },
  releasedValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  helperSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 10,
  },
  helperText: {
    flex: 1,
    fontSize: 13,
    color: '#558B2F',
    lineHeight: 18,
  },
  noPayoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noPayoutText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  doneButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
