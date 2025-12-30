import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getServiceLabel } from '../constants/serviceCategories';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Tab bar height constant - must match the provider _layout.tsx
const TAB_BAR_BASE_HEIGHT = 60;

interface ServiceRequest {
  _id: string;
  service: string;
  description: string;
  providerName: string;
  customerName: string;
  customerPhone: string;
  customerId: string;
  providerId?: string;
  status: string;
  createdAt: string;
  preferredDateTime?: string;
  isGeneralRequest?: boolean;
  subCategory?: string;
  location?: string;
  jobTown?: string;
  jobCode?: string;
  jobStartedAt?: string;
  jobCompletedAt?: string;
}

interface Message {
  _id: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'provider';
  text: string;
  createdAt: string;
}

type TabType = 'details' | 'chat';

export default function ProviderRequestDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const requestId = params.requestId as string;

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Job code entry
  const [jobCodeInput, setJobCodeInput] = useState('');
  const [confirmingArrival, setConfirmingArrival] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Calculate bottom spacing to clear tab bar + system nav
  const bottomTabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom + (Platform.OS === 'android' ? 20 : 8);

  useEffect(() => {
    if (requestId) {
      fetchRequestDetail();
    } else {
      setError('No request ID provided');
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (activeTab === 'chat' && request) {
      fetchMessages();
    }
  }, [activeTab, request?._id]);

  const fetchRequestDetail = async () => {
    try {
      setError(null);
      const response = await axios.get(`${BACKEND_URL}/api/service-requests/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequest(response.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('This request could not be found.');
      } else if (err.response?.status === 403) {
        setError('You don\'t have permission to view this request.');
      } else {
        setError('Unable to load request details. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMessages = async () => {
    if (!request?._id) return;

    setLoadingMessages(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/service-requests/${request._id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(response.data.messages || []);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.log('Messages fetch error');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !request?._id) return;

    Keyboard.dismiss();
    setSendingMessage(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/service-requests/${request._id}/messages`,
        { text: newMessage.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewMessage('');
      fetchMessages();
    } catch (err) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAccept = () => {
    Alert.alert(
      'Accept Request',
      'Are you sure you want to accept this service request?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: () => updateRequestStatus('accept') },
      ]
    );
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline Request',
      'Are you sure you want to decline this service request?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => updateRequestStatus('decline') },
      ]
    );
  };

  const updateRequestStatus = async (action: 'accept' | 'decline') => {
    setActionLoading(true);
    try {
      await axios.patch(
        `${BACKEND_URL}/api/service-requests/${requestId}/${action}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert(
        'Success',
        `Request ${action === 'accept' ? 'accepted' : 'declined'} successfully!`,
        [{ text: 'OK', onPress: () => fetchRequestDetail() }]
      );
    } catch (err) {
      Alert.alert('Error', `Failed to ${action} request. Please try again.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmArrival = async () => {
    if (!jobCodeInput.trim() || !request?._id) return;

    setConfirmingArrival(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/service-requests/${request._id}/confirm-arrival`,
        { jobCode: jobCodeInput.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Job started successfully!');
      setJobCodeInput('');
      fetchRequestDetail();
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Incorrect code. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setConfirmingArrival(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!request?._id) return;

    Alert.alert(
      'Complete Job',
      'Mark this job as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await axios.patch(
                `${BACKEND_URL}/api/service-requests/${request._id}/complete`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
              );
              Alert.alert('Success', 'Job marked as complete!');
              fetchRequestDetail();
            } catch (err) {
              Alert.alert('Error', 'Failed to complete job. Please try again.');
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequestDetail();
    if (activeTab === 'chat') {
      fetchMessages();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'accepted':
        return { bg: '#E8F5E9', text: '#2E7D32', icon: 'checkmark-circle', label: 'Accepted' };
      case 'started':
        return { bg: '#E3F2FD', text: '#1565C0', icon: 'play-circle', label: 'In Progress' };
      case 'completed':
        return { bg: '#F3E5F5', text: '#7B1FA2', icon: 'checkmark-done-circle', label: 'Completed' };
      case 'declined':
        return { bg: '#FFEBEE', text: '#C62828', icon: 'close-circle', label: 'Declined' };
      default:
        return { bg: '#FFF3E0', text: '#F57C00', icon: 'time', label: 'Pending Review' };
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.title}>Request Details</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#E53935" />
          <Text style={styles.loadingText}>Loading request...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error || !request) {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.title}>Request Details</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="document-text-outline" size={64} color="#CCC" />
          <Text style={styles.errorTitle}>Unable to Load</Text>
          <Text style={styles.errorText}>{error || 'This request could not be found.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchRequestDetail(); }}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusInfo = getStatusInfo(request.status);
  const isPending = request.status === 'pending';

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      {/* Header with compact status badge */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Request Details</Text>
          {/* Compact status badge in header */}
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Ionicons name={statusInfo.icon as any} size={12} color={statusInfo.text} />
            <Text style={[styles.statusBadgeText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
          </View>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'details' && styles.tabActive]}
          onPress={() => setActiveTab('details')}
        >
          <Ionicons name="document-text-outline" size={18} color={activeTab === 'details' ? '#E53935' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>Details</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
          onPress={() => setActiveTab('chat')}
        >
          <Ionicons name="chatbubbles-outline" size={18} color={activeTab === 'chat' ? '#E53935' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>Messages</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'details' ? (
        <View style={styles.detailsContainer}>
          <ScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.contentContainer, 
              { paddingBottom: isPending ? 100 : bottomTabBarHeight + 16 }
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {/* Customer & Service Summary Card - TOP PRIORITY INFO */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Ionicons name="person" size={20} color="#E53935" />
                <View style={styles.summaryContent}>
                  <Text style={styles.summaryLabel}>Customer</Text>
                  <Text style={styles.summaryValue}>{request.customerName}</Text>
                </View>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Ionicons name="construct" size={20} color="#E53935" />
                <View style={styles.summaryContent}>
                  <Text style={styles.summaryLabel}>Service</Text>
                  <Text style={styles.summaryValue}>{getServiceLabel(request.service)}</Text>
                  {request.subCategory && <Text style={styles.subCategoryText}>{request.subCategory}</Text>}
                </View>
              </View>
              {(request.jobTown || request.location) && (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Ionicons name="location" size={20} color="#E53935" />
                    <View style={styles.summaryContent}>
                      <Text style={styles.summaryLabel}>Location</Text>
                      <Text style={styles.summaryValue}>{request.jobTown || request.location}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Description */}
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionLabel}>Job Description</Text>
              <Text style={styles.descriptionText}>{request.description}</Text>
            </View>

            {/* Schedule Info */}
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={16} color="#666" />
                <Text style={styles.infoLabel}>Preferred</Text>
                <Text style={styles.infoValue}>{formatDateTime(request.preferredDateTime)}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={16} color="#666" />
                <Text style={styles.infoLabel}>Requested</Text>
                <Text style={styles.infoValue}>{formatDate(request.createdAt)}</Text>
              </View>
            </View>

            {/* Job Code Entry - Compact, subtle light blue */}
            {request.status === 'accepted' && (
              <View style={styles.jobCodeSection}>
                <Text style={styles.jobCodeLabel}>Enter Job Code</Text>
                <Text style={styles.jobCodeHint}>Ask the customer for the 6-digit code</Text>
                <View style={styles.jobCodeInputRow}>
                  <TextInput
                    style={styles.jobCodeInput}
                    placeholder="000 000"
                    placeholderTextColor="#A0C4E8"
                    value={jobCodeInput}
                    onChangeText={setJobCodeInput}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[styles.startJobButton, (!jobCodeInput.trim() || confirmingArrival) && styles.startJobButtonDisabled]}
                    onPress={handleConfirmArrival}
                    disabled={!jobCodeInput.trim() || confirmingArrival}
                  >
                    {confirmingArrival ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.startJobButtonText}>Start Job</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Complete Job Button (when started) */}
            {request.status === 'started' && (
              <TouchableOpacity style={styles.completeJobButton} onPress={handleCompleteJob}>
                <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
                <Text style={styles.completeJobButtonText}>Mark Job as Complete</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* FIXED ACTION BUTTONS AT BOTTOM - Only for pending requests */}
          {isPending && (
            <View style={[styles.fixedActionBar, { paddingBottom: bottomTabBarHeight + 8 }]}>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={handleDecline}
                disabled={actionLoading}
              >
                <Ionicons name="close" size={22} color="#C62828" />
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={handleAccept}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={22} color="#FFFFFF" />
                    <Text style={styles.acceptButtonText}>Accept Job</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        /* Chat Tab - Uses KeyboardAvoidingView */
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {loadingMessages ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#E53935" />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyChatContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#CCC" />
              <Text style={styles.emptyChatTitle}>No messages yet</Text>
              <Text style={styles.emptyChatText}>Keep all job communication in one place</Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {messages.map((msg) => {
                const isMine = msg.senderId === user?.id;
                return (
                  <View key={msg._id} style={[styles.messageBubble, isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs]}>
                    {!isMine && <Text style={styles.messageSender}>{msg.senderName}</Text>}
                    <Text style={[styles.messageText, isMine && styles.messageTextMine]}>{msg.text}</Text>
                    <Text style={[styles.messageTime, isMine && styles.messageTimeMine]}>{formatMessageTime(msg.createdAt)}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Message Input - Fixed at bottom, above tab bar */}
          <View style={[styles.messageInputContainer, { paddingBottom: bottomTabBarHeight + 8 }]}>
            <TextInput
              ref={inputRef}
              style={styles.messageInput}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={1000}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[styles.sendButton, (!newMessage.trim() || sendingMessage) && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || sendingMessage}
            >
              {sendingMessage ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
  headerCenter: {
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  // Compact status badge in header
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
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
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#E53935',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#E53935',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#E53935',
    fontWeight: '600',
  },
  detailsContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  // Summary Card - Customer & Service info
  summaryCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '600',
    marginTop: 2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  subCategoryText: {
    fontSize: 13,
    color: '#E53935',
    marginTop: 2,
  },
  // Description Card
  descriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  descriptionLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  // Info Row
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
    marginTop: 4,
  },
  infoValue: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  // Job Code Section
  jobCodeSection: {
    backgroundColor: '#FFF8E1',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  jobCodeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  jobCodeHint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  jobCodeInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  jobCodeInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 4,
  },
  confirmButton: {
    backgroundColor: '#E53935',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  confirmButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  completeJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  completeJobButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // FIXED ACTION BAR - Primary CTA area
  fixedActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    // Shadow for elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#C62828',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  declineButtonText: {
    color: '#C62828',
    fontSize: 16,
    fontWeight: '700',
  },
  acceptButton: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Chat styles
  chatContainer: {
    flex: 1,
  },
  emptyChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyChatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 12,
  },
  emptyChatText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  messageBubbleMine: {
    backgroundColor: '#E53935',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  messageBubbleTheirs: {
    backgroundColor: '#F0F0F0',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  messageTextMine: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeMine: {
    color: 'rgba(255,255,255,0.7)',
  },
  messageInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    gap: 8,
    alignItems: 'flex-end',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 44,
    color: '#1A1A1A',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
});
