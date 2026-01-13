import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface ReceiptData {
  transactionId: string;
  paymentProviderTxnId: string;
  jobId: string;
  quoteId: string;
  jobPrice: number;
  serviceFee: number;
  totalPaidByCustomer: number;
  currency: string;
  vatEnabled: boolean;
  vatRate: number;
  vatTotal: number;
  status: string;
  paidAt: string;
}

export default function ReceiptScreen() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReceipt();
  }, [requestId]);

  const fetchReceipt = async () => {
    if (!requestId) {
      setError('No request ID provided');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/receipts/by-job/${requestId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReceipt(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load receipt');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `$${amount.toFixed(2)} ${currency}`;
  };

  const truncateId = (id: string) => {
    if (id.length > 16) {
      return `${id.substring(0, 8)}...${id.substring(id.length - 4)}`;
    }
    return id;
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Receipt</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2ecc71" />
          <Text style={styles.loadingText}>Loading receipt...</Text>
        </View>
      </View>
    );
  }

  if (error || !receipt) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Receipt</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="receipt-outline" size={64} color="#ccc" />
          <Text style={styles.errorText}>{error || 'Receipt not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchReceipt}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Receipt</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Success Icon */}
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={64} color="#2ecc71" />
        </View>

        {/* Receipt Card */}
        <View style={styles.receiptCard}>
          {/* Transaction ID */}
          <View style={styles.receiptHeader}>
            <Text style={styles.receiptLabel}>Transaction ID</Text>
            <Text style={styles.transactionId}>{truncateId(receipt.transactionId)}</Text>
          </View>

          {/* Date */}
          <View style={styles.receiptRow}>
            <Text style={styles.rowLabel}>Date & Time</Text>
            <Text style={styles.rowValue}>{formatDate(receipt.paidAt)}</Text>
          </View>

          <View style={styles.divider} />

          {/* Breakdown */}
          <Text style={styles.sectionTitle}>Payment Breakdown</Text>

          <View style={styles.receiptRow}>
            <Text style={styles.rowLabel}>Job Price</Text>
            <Text style={styles.rowValue}>{formatCurrency(receipt.jobPrice, receipt.currency)}</Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.rowLabel}>Service Fee</Text>
            <Text style={styles.rowValue}>{formatCurrency(receipt.serviceFee, receipt.currency)}</Text>
          </View>

          {/* VAT - only show if enabled */}
          {receipt.vatEnabled && receipt.vatTotal > 0 && (
            <View style={styles.receiptRow}>
              <Text style={styles.rowLabel}>VAT ({(receipt.vatRate * 100).toFixed(0)}%)</Text>
              <Text style={styles.rowValue}>{formatCurrency(receipt.vatTotal, receipt.currency)}</Text>
            </View>
          )}

          <View style={styles.divider} />

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalValue}>{formatCurrency(receipt.totalPaidByCustomer, receipt.currency)}</Text>
          </View>

          {/* Status Badge */}
          <View style={styles.statusContainer}>
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#2ecc71" />
              <Text style={styles.statusText}>Payment Completed</Text>
            </View>
          </View>
        </View>

        {/* Footer Note */}
        <Text style={styles.footerNote}>
          This receipt confirms your payment. The provider has been notified and can start your job.
        </Text>
      </ScrollView>

      {/* Done Button */}
      <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2ecc71',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: 20,
  },
  receiptCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  receiptLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  transactionId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowLabel: {
    fontSize: 15,
    color: '#666',
  },
  rowValue: {
    fontSize: 15,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2ecc71',
  },
  statusContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#2ecc71',
  },
  footerNote: {
    marginTop: 20,
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  doneButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
