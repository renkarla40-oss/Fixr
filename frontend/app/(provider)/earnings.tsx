import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { api, formatApiError } from '../../utils/apiClient';
import {
  getCachedData,
  setCachedData,
  shouldRefetch,
  markFetchStarted,
  isRequestInFlight,
  setRequestInFlight,
  isInBackoff,
  setBackoff,
  clearBackoff,
} from '../../utils/screenCache';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const CACHE_KEY = 'provider_earnings';

interface Transaction {
  jobId: string;
  service: string;
  jobAmount: number;
  commission: number;
  netEarnings: number;
  amount: number;  // Keep for backward compatibility
  currency: string;
  status: 'held' | 'available' | 'released';
  date: string;
  customerName: string;
}

interface EarningsData {
  heldBalance: number;
  availableBalance: number;
  lifetimeEarned: number;
  currency: string;
  recentTransactions: Transaction[];
  payoutsEnabled: boolean;
}

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();
  
  // INSTANT NAVIGATION: Initialize with cached data
  const cachedData = getCachedData<EarningsData>(CACHE_KEY);
  const [earnings, setEarnings] = useState<EarningsData | null>(cachedData);
  const [loading, setLoading] = useState(!cachedData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEarnings = useCallback(async () => {
    if (!token) return;
    
    // SINGLE-FLIGHT: Skip if already fetching
    if (isRequestInFlight(CACHE_KEY)) {
      console.log('[FETCH] Provider Earnings skip (already in-flight)');
      return;
    }
    
    // BACKOFF: Skip if in backoff period
    if (isInBackoff(CACHE_KEY)) {
      console.log('[FETCH] Provider Earnings skip (in backoff)');
      return;
    }
    
    console.log('[NAV] Provider Earnings focused');
    console.log('[FETCH] Provider Earnings start');
    
    setRequestInFlight(CACHE_KEY, true);
    markFetchStarted(CACHE_KEY);
    
    try {
      const response = await api.get(`${BACKEND_URL}/api/providers/me/earnings`, {
        headers: { Authorization: `Bearer ${token}` },
        actionName: 'Load Earnings',
      });
      
      if (response.success && response.data) {
        setEarnings(response.data);
        setCachedData(CACHE_KEY, response.data);
        clearBackoff(CACHE_KEY);
        setError(null);
        console.log('[FETCH] Provider Earnings success');
      } else if (response.error) {
        if (response.error.statusCode === 429) {
          setBackoff(CACHE_KEY, 1);
        }
        // Only show error if no cached data
        if (!earnings) {
          setError(formatApiError(response.error));
        }
        console.log(`[FETCH] Provider Earnings failed ${response.error.statusCode || 'unknown'}`);
      }
    } catch (err: any) {
      console.log('[FETCH] Provider Earnings failed (exception)');
      if (!earnings) {
        setError('Failed to load earnings');
      }
    } finally {
      setRequestInFlight(CACHE_KEY, false);
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, earnings]);

  // Use useFocusEffect instead of useEffect for better navigation handling
  useFocusEffect(
    useCallback(() => {
      if (shouldRefetch(CACHE_KEY)) {
        fetchEarnings();
      } else if (cachedData) {
        setLoading(false);
      }
    }, [token])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchEarnings();
  };

  const formatCurrency = (amount: number, currency: string = 'TTD') => {
    return `$${amount.toFixed(2)} ${currency}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'available':
        return { bg: '#E8F5E9', text: '#2E7D32', label: 'Available' };
      case 'held':
        return { bg: '#FFF3E0', text: '#E65100', label: 'Pending' };
      case 'released':
        return { bg: '#E3F2FD', text: '#1565C0', label: 'Released' };
      default:
        return { bg: '#F5F5F5', text: '#666', label: status };
    }
  };

  if (loading && !earnings) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 50 }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Earnings</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#E53935" />
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      </View>
    );
  }

  if (error && !earnings) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 50 }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Earnings</Text>
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color="#E53935" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchEarnings}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 50 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Earnings</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#E53935']} />
        }
      >
        {/* Balance Summary Section */}
        <Text style={styles.sectionTitle}>Balance Summary</Text>
        
        {/* Available Balance */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceLeft}>
              <Ionicons name="wallet-outline" size={18} color="#2E7D32" />
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceLabel}>Available Balance</Text>
                <Text style={styles.balanceHint}>Ready for withdrawal</Text>
              </View>
            </View>
            <Text style={styles.balanceAmountPrimary}>
              {formatCurrency(earnings?.availableBalance || 0, earnings?.currency)}
            </Text>
          </View>
        </View>

        {/* Pending Earnings (formerly Held Balance) */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceLeft}>
              <Ionicons name="time-outline" size={18} color="#E65100" />
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceLabel}>Pending Earnings</Text>
                <Text style={styles.balanceHint}>Jobs in progress or awaiting confirmation</Text>
              </View>
            </View>
            <Text style={styles.balanceAmountSecondary}>
              {formatCurrency(earnings?.heldBalance || 0, earnings?.currency)}
            </Text>
          </View>
        </View>

        {/* Total Earned (formerly Lifetime Earned) */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceLeft}>
              <Ionicons name="trending-up-outline" size={18} color="#999" />
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceLabelTertiary}>Total Earned</Text>
                <Text style={styles.balanceHint}>All-time earnings on Fixr</Text>
              </View>
            </View>
            <Text style={styles.balanceAmountTertiary}>
              {formatCurrency(earnings?.lifetimeEarned || 0, earnings?.currency)}
            </Text>
          </View>
        </View>

        {/* Withdraw Notice - Separated */}
        <View style={styles.withdrawContainer}>
          <TouchableOpacity style={styles.withdrawButton} disabled>
            <Text style={styles.withdrawButtonText}>Withdraw (Coming Soon)</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          
          {earnings?.recentTransactions && earnings.recentTransactions.length > 0 ? (
            earnings.recentTransactions.map((txn, index) => {
              const statusStyle = getStatusStyle(txn.status);
              const serviceName = txn.service.charAt(0).toUpperCase() + txn.service.slice(1);
              return (
                <View key={txn.jobId + index}>
                  <View style={styles.transactionCard}>
                    {/* Header: Service name + Status */}
                    <View style={styles.transactionHeader}>
                      <Text style={styles.transactionService}>{serviceName}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.statusText, { color: statusStyle.text }]}>
                          {statusStyle.label}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Customer + Date */}
                    <Text style={styles.transactionMeta}>
                      {txn.customerName} • {formatDate(txn.date)}
                    </Text>
                    
                    {/* Earnings Breakdown */}
                    <View style={styles.breakdownContainer}>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Job Amount</Text>
                        <Text style={styles.breakdownValue}>
                          {formatCurrency(txn.jobAmount || txn.amount, txn.currency)}
                        </Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabelDeduct}>Fixr Commission</Text>
                        <Text style={styles.breakdownValueDeduct}>
                          −{formatCurrency(txn.commission || 0, txn.currency)}
                        </Text>
                      </View>
                      <View style={styles.breakdownDivider} />
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabelNet}>Net Earnings</Text>
                        <Text style={styles.breakdownValueNet}>
                          {formatCurrency(txn.netEarnings || txn.amount, txn.currency)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {index < earnings.recentTransactions.length - 1 && (
                    <View style={styles.cardSpacer} />
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptyHint}>Complete jobs to see your earnings here</Text>
            </View>
          )}
        </View>

        {/* Info Notice */}
        <Text style={styles.infoNotice}>
          Payouts are processed manually during Phase 1.{'\n'}
          Earnings move from Pending to Available after job completion is confirmed.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#E53935',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#E53935',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  balanceInfo: {
    marginLeft: 10,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  balanceLabelTertiary: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  balanceHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 1,
  },
  balanceAmountPrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  balanceAmountSecondary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E65100',
  },
  balanceAmountTertiary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  withdrawContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  withdrawButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    opacity: 0.5,
  },
  withdrawButtonText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  transactionLeft: {
    flex: 1,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionService: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  transactionMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  emptyHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  infoNotice: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  // New transaction card styles for earnings breakdown
  transactionCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardSpacer: {
    height: 10,
  },
  breakdownContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#666',
  },
  breakdownValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  breakdownLabelDeduct: {
    fontSize: 13,
    color: '#E53935',
  },
  breakdownValueDeduct: {
    fontSize: 13,
    color: '#E53935',
    fontWeight: '500',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 6,
  },
  breakdownLabelNet: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  breakdownValueNet: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '700',
  },
});
