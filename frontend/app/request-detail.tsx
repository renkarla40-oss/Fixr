import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
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

// Tab bar height constant - must match the customer _layout.tsx
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
  subCategory?: string;
  location?: string;
  jobTown?: string;
  // Phase 4 fields
  jobCode?: string;
  jobStartedAt?: string;
  jobCompletedAt?: string;
  customerRating?: number;
  customerReview?: string;
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

export default function RequestDetailScreen() {
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
  const [error, setError] = useState<string | null>(null);
  
  // For job code entry (provider)
  const [jobCodeInput, setJobCodeInput] = useState('');
  const [confirmingArrival, setConfirmingArrival] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const isCustomer = user?.id === request?.customerId;
  const isProvider = user?.currentRole === 'provider';

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
      console.log('Request detail fetch error:', err.response?.status);
      if (err.response?.status === 404) {
        setError('This request could not be found. It may have been removed.');
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
      // Scroll to bottom
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
        return { bg: '#FFF3E0', text: '#F57C00', icon: 'time', label: 'Pending' };
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

  // Error state (friendly, no technical errors)
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

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.title}>Request Details</Text>
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
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomTabBarHeight + 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Status Banner */}
          <View style={[styles.statusSection, { backgroundColor: statusInfo.bg }]}>
            <Ionicons name={statusInfo.icon as any} size={40} color={statusInfo.text} />
            <Text style={[styles.statusLabel, { color: statusInfo.text }]}>{statusInfo.label}</Text>
          </View>

          {/* Job Code Section (Customer sees code, Provider enters code) */}
          {request.status === 'accepted' && (
            <View style={styles.jobCodeSection}>
              {isCustomer ? (
                <>
                  <Text style={styles.jobCodeTitle}>Job Confirmation Code</Text>
                  <Text style={styles.jobCodeHint}>Share this code when the provider arrives</Text>
                  <View style={styles.jobCodeDisplay}>
                    <Text style={styles.jobCodeText}>{request.jobCode || '------'}</Text>
                  </View>
                </>
              ) : isProvider ? (
                <>
                  <Text style={styles.jobCodeTitle}>Confirm Your Arrival</Text>
                  <Text style={styles.jobCodeHint}>Enter the 6-digit code from the customer</Text>
                  <View style={styles.jobCodeInputRow}>
                    <TextInput
                      style={styles.jobCodeInput}
                      placeholder="Enter code"
                      value={jobCodeInput}
                      onChangeText={setJobCodeInput}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <TouchableOpacity
                      style={[styles.confirmButton, (!jobCodeInput.trim() || confirmingArrival) && styles.confirmButtonDisabled]}
                      onPress={handleConfirmArrival}
                      disabled={!jobCodeInput.trim() || confirmingArrival}
                    >
                      {confirmingArrival ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.confirmButtonText}>Start Job</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}
            </View>
          )}

          {/* Complete Job Button (Provider only, when started) */}
          {request.status === 'started' && isProvider && (
            <TouchableOpacity style={styles.completeJobButton} onPress={handleCompleteJob}>
              <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
              <Text style={styles.completeJobButtonText}>Mark Job as Complete</Text>
            </TouchableOpacity>
          )}

          {/* Service Info */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="construct" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Service</Text>
            </View>
            <Text style={styles.sectionContent}>
              {getServiceLabel(request.service)}
            </Text>
            {request.subCategory && (
              <Text style={styles.subCategoryText}>{request.subCategory}</Text>
            )}
          </View>

          {/* Provider/Customer Info */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person" size={20} color="#666" />
              <Text style={styles.sectionTitle}>{isCustomer ? 'Provider' : 'Customer'}</Text>
            </View>
            <Text style={styles.sectionContent}>
              {isCustomer ? (request.providerName || 'Open Request') : request.customerName}
            </Text>
          </View>

          {/* Location */}
          {(request.jobTown || request.location) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="location" size={20} color="#666" />
                <Text style={styles.sectionTitle}>Location</Text>
              </View>
              <Text style={styles.sectionContent}>{request.jobTown || request.location}</Text>
            </View>
          )}

          {/* Description */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Description</Text>
            </View>
            <Text style={styles.descriptionText}>{request.description}</Text>
          </View>

          {/* Preferred Date */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Preferred Date & Time</Text>
            </View>
            <Text style={styles.sectionContent}>{formatDateTime(request.preferredDateTime)}</Text>
          </View>

          {/* Request Date */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time" size={20} color="#666" />
              <Text style={styles.sectionTitle}>Requested On</Text>
            </View>
            <Text style={styles.sectionContent}>{formatDate(request.createdAt)}</Text>
          </View>
        </ScrollView>
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
          <View style={[
            styles.messageInputContainer, 
            { 
              paddingBottom: bottomTabBarHeight + 8,
              // Add margin bottom to ensure it clears the tab bar
              marginBottom: 0,
            }
          ]}>
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
  // Tab bar
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
  // Details tab
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  statusSection: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  // Job code section
  jobCodeSection: {
    backgroundColor: '#FFF8E1',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
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
  jobCodeDisplay: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  jobCodeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F57C00',
    letterSpacing: 6,
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
    marginBottom: 20,
    gap: 8,
  },
  completeJobButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  subCategoryText: {
    fontSize: 14,
    color: '#E53935',
    marginTop: 4,
  },
  descriptionText: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  // Chat tab
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
