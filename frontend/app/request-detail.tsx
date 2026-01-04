import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getServiceLabel } from '../constants/serviceCategories';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  jobCode?: string;
  startedAt?: string;
  completedAt?: string;
  completionOtp?: string;
  customerRating?: number;
  customerReview?: string;
}

interface Message {
  _id: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'provider';
  type?: 'text' | 'image';
  text?: string;
  imageUrl?: string;
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
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
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const unreadPollingRef = useRef<NodeJS.Timeout | null>(null);
  const statusPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate bottom spacing to clear tab bar + system nav
  const bottomTabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom + (Platform.OS === 'android' ? 20 : 8);

  // Fetch request detail on mount and screen focus
  useFocusEffect(
    useCallback(() => {
      if (requestId) {
        fetchRequestDetail();
      } else {
        setError('No request ID provided');
        setLoading(false);
      }
    }, [requestId, token])
  );

  // CRITICAL: Continuous status polling - runs independently of tabs
  // This ensures customer sees OTP completion updates in real-time
  useEffect(() => {
    if (!requestId || !token) return;

    const pollRequestStatus = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/service-requests/${requestId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRequest(response.data);
      } catch (err) {
        // Silent fail for polling
      }
    };

    // Poll every 3 seconds for status updates
    statusPollingRef.current = setInterval(pollRequestStatus, 3000);

    return () => {
      if (statusPollingRef.current) {
        clearInterval(statusPollingRef.current);
        statusPollingRef.current = null;
      }
    };
  }, [requestId, token]);

  useEffect(() => {
    if (activeTab === 'chat' && request) {
      // Mark messages as read when opening chat tab
      setHasUnreadMessages(false);
      fetchMessages();
      // Mark messages as read on server, then refresh to get updated readAt
      markMessagesAsRead().then(() => {
        // Refresh messages to show updated read status (blue ticks)
        fetchMessagesQuietly();
      });
      
      // Start polling every 2 seconds when chat is active
      pollingIntervalRef.current = setInterval(() => {
        fetchMessagesQuietly();
      }, 2000);
    } else if (activeTab === 'details' && request) {
      // Poll for unread messages while on details tab
      checkForUnreadMessages();
      unreadPollingRef.current = setInterval(() => {
        checkForUnreadMessages();
      }, 2000);
    }
    
    // Cleanup polling on tab change or unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (unreadPollingRef.current) {
        clearInterval(unreadPollingRef.current);
        unreadPollingRef.current = null;
      }
    };
  }, [activeTab, request, user?._id]);

  // Mark all messages from the other user as read
  const markMessagesAsRead = async () => {
    if (!request?._id) return;
    try {
      await axios.post(
        `${BACKEND_URL}/api/messages/mark-read`,
        { jobId: request._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      // Silent fail - not critical
    }
  };

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
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.log('Messages fetch error');
    } finally {
      setLoadingMessages(false);
    }
  };

  // Quiet fetch for polling - no loading state, merge by ID to prevent duplicates
  const fetchMessagesQuietly = async () => {
    if (!request?._id) return;
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/service-requests/${request._id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const newMessages = response.data.messages || [];
      
      // Only update if there are new messages (compare by length and last message ID)
      setMessages(prev => {
        if (newMessages.length !== prev.length || 
            (newMessages.length > 0 && prev.length > 0 && 
             newMessages[newMessages.length - 1]._id !== prev[prev.length - 1]._id)) {
          // Scroll to end when new messages arrive
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
          return newMessages;
        }
        return prev;
      });
    } catch (err) {
      // Silent fail for polling
    }
  };

  // Check for unread messages while on Details tab
  // Uses server-side readAt field for accurate unread detection
  const checkForUnreadMessages = async () => {
    if (!request?._id || !user?._id) return;
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/service-requests/${request._id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allMessages: Message[] = response.data.messages || [];
      
      // Find messages from the OTHER user that haven't been read (readAt is null)
      const unreadMessages = allMessages.filter(msg => 
        msg.senderId !== user._id && !msg.readAt
      );
      
      setHasUnreadMessages(unreadMessages.length > 0);
    } catch (err) {
      // Silent fail
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !request?._id) return;
    
    // Prevent sending if job is completed
    if (request.status === 'completed') {
      Alert.alert('Chat Closed', 'Chat is read-only after job completion.');
      return;
    }

    const messageText = newMessage.trim();
    Keyboard.dismiss();
    
    // OPTIMISTIC UI: Add message immediately to local state
    const optimisticMessage: Message = {
      _id: `temp_${Date.now()}`,
      senderId: user?._id || '',
      senderName: user?.name || 'You',
      senderRole: 'customer',
      type: 'text',
      text: messageText,
      createdAt: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
    
    setSendingMessage(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/service-requests/${request._id}/messages`,
        { type: 'text', text: messageText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Refetch to get server-confirmed message (replaces optimistic one)
      fetchMessagesQuietly();
    } catch (err: any) {
      // On error, remove optimistic message and restore input
      setMessages(prev => prev.filter(m => m._id !== optimisticMessage._id));
      setNewMessage(messageText);
      
      // Handle 403 - chat closed after job completion
      if (err.response?.status === 403) {
        Alert.alert('Chat Closed', 'Chat is read-only after job completion.');
        // Refetch request to update status
        fetchRequestDetail();
      } else {
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
    } finally {
      setSendingMessage(false);
    }
  };

  // Image picker and upload
  const handlePickImage = async () => {
    if (request?.status === 'completed') {
      Alert.alert('Chat Closed', 'Chat is read-only after job completion.');
      return;
    }

    // Request permission
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      uploadAndSendImage(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    if (request?.status === 'completed') {
      Alert.alert('Chat Closed', 'Chat is read-only after job completion.');
      return;
    }

    // Request camera permission
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      uploadAndSendImage(result.assets[0].uri);
    }
  };

  const uploadAndSendImage = async (imageUri: string) => {
    if (!request?._id) return;
    
    setUploadingImage(true);
    try {
      // Create form data for upload
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('file', {
        uri: imageUri,
        name: filename,
        type,
      } as any);

      // Upload image
      const uploadResponse = await axios.post(
        `${BACKEND_URL}/api/uploads/chat-image`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const imageUrl = uploadResponse.data.imageUrl;

      // Send image message
      await axios.post(
        `${BACKEND_URL}/api/service-requests/${request._id}/messages`,
        { type: 'image', imageUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refetch messages to show the new image
      fetchMessagesQuietly();
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      console.log('Image upload error:', err);
      if (err.response?.status === 403) {
        Alert.alert('Chat Closed', 'Chat is read-only after job completion.');
      } else {
        Alert.alert('Error', 'Failed to upload image. Please try again.');
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const showImageOptions = () => {
    if (request?.status === 'completed') {
      Alert.alert('Chat Closed', 'Chat is read-only after job completion.');
      return;
    }
    
    Alert.alert(
      'Send Photo',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Library', onPress: handlePickImage },
        { text: 'Cancel', style: 'cancel' },
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
      case 'in_progress':
      case 'started':
        return { bg: '#E3F2FD', text: '#1565C0', icon: 'play-circle', label: 'In Progress' };
      case 'completed':
        return { bg: '#F3E5F5', text: '#7B1FA2', icon: 'checkmark-done-circle', label: 'Completed' };
      case 'declined':
        return { bg: '#FFEBEE', text: '#C62828', icon: 'close-circle', label: 'Declined' };
      case 'cancelled':
        return { bg: '#FFF3E0', text: '#E65100', icon: 'close-circle-outline', label: 'Cancelled' };
      default:
        return { bg: '#EAF3FF', text: '#4A7DC4', icon: 'time', label: 'Pending' };
    }
  };

  // Check if customer can cancel this request (only pending or accepted)
  const canCancel = request && ['pending', 'accepted'].includes(request.status);

  const handleCancelRequest = async () => {
    if (!request?._id) return;
    
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('authToken');
              await axios.patch(
                `${BACKEND_URL}/api/service-requests/${request._id}/cancel`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
              );
              // Refresh the request details
              fetchRequestDetail();
              Alert.alert('Cancelled', 'Your request has been cancelled.');
            } catch (err: any) {
              Alert.alert('Unable to Cancel', 'We couldn\'t cancel this request. Please try again.');
            }
          },
        },
      ]
    );
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="chatbubbles-outline" size={18} color={activeTab === 'chat' ? '#E53935' : '#666'} />
            {hasUnreadMessages && activeTab !== 'chat' && (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#E53935', marginLeft: 2 }} />
            )}
          </View>
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
          {/* JOB CODE CARD - Compact, subtle light blue */}
          {request.status === 'accepted' && request.jobCode && (
            <View style={styles.jobCodeCard}>
              <Text style={styles.jobCodeLabel}>Job Code</Text>
              <Text style={styles.jobCodeValue}>
                {request.jobCode.slice(0, 3)} {request.jobCode.slice(3)}
              </Text>
              <Text style={styles.jobCodeHint}>Share this code when the provider arrives</Text>
            </View>
          )}

          {/* COMPLETION OTP CARD - Show when job is in progress */}
          {(request.status === 'in_progress' || request.status === 'started') && request.completionOtp && (
            <View style={styles.completionOtpCard}>
              <View style={styles.completionOtpHeader}>
                <Ionicons name="key" size={22} color="#4CAF50" />
                <Text style={styles.completionOtpTitle}>Completion OTP</Text>
              </View>
              <Text style={styles.completionOtpValue}>
                {request.completionOtp.slice(0, 3)} {request.completionOtp.slice(3)}
              </Text>
              <Text style={styles.completionOtpHint}>Share this code with the provider when the job is completed</Text>
            </View>
          )}

          {/* In Progress Status - Light blue theme */}
          {(request.status === 'in_progress' || request.status === 'started') && (
            <View style={styles.inProgressCard}>
              <Ionicons name="play-circle" size={22} color="#4A90D9" />
              <View style={styles.inProgressContent}>
                <Text style={styles.inProgressTitle}>Job In Progress</Text>
                <Text style={styles.inProgressText}>The provider is working on your request</Text>
              </View>
            </View>
          )}

          {/* Provider & Service Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Ionicons name="person" size={20} color="#E53935" />
              <View style={styles.summaryContent}>
                <Text style={styles.summaryLabel}>Provider</Text>
                <Text style={styles.summaryValue}>{request.providerName || 'Open Request'}</Text>
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

          {/* Cancel Button - Only shown for pending or accepted requests */}
          {canCancel && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelRequest}>
              <Ionicons name="close-circle-outline" size={20} color="#E53935" />
              <Text style={styles.cancelButtonText}>Cancel Request</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        /* Chat Tab */
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
                const isMine = msg.senderId === user?._id;
                return (
                  <View key={msg._id} style={[styles.messageBubble, isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs]}>
                    {!isMine && <Text style={styles.messageSender}>{msg.senderName}</Text>}
                    <Text style={[styles.messageText, isMine && styles.messageTextMine]}>{msg.text}</Text>
                    <View style={styles.messageFooter}>
                      <Text style={[styles.messageTime, isMine && styles.messageTimeMine]}>{formatMessageTime(msg.createdAt)}</Text>
                      {/* Read indicators - only for messages I sent */}
                      {isMine && (
                        <View style={styles.tickContainer}>
                          {msg.readAt ? (
                            // Blue double tick - Read
                            <View style={styles.ticksRow}>
                              <Ionicons name="checkmark" size={14} color="#4FC3F7" />
                              <Ionicons name="checkmark" size={14} color="#4FC3F7" style={styles.secondTick} />
                            </View>
                          ) : msg.deliveredAt ? (
                            // Grey double tick - Delivered
                            <View style={styles.ticksRow}>
                              <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.6)" />
                              <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.6)" style={styles.secondTick} />
                            </View>
                          ) : (
                            // Single tick - Sent
                            <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.6)" />
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Message Input or Read-Only Banner */}
          {request.status === 'completed' ? (
            <View style={[styles.chatClosedBanner, { paddingBottom: insets.bottom + 12 }]}>
              <Ionicons name="lock-closed" size={16} color="#666" />
              <Text style={styles.chatClosedText}>Chat closed — job completed.</Text>
            </View>
          ) : (
            <View style={[styles.messageInputContainer, { paddingBottom: insets.bottom + 12 }]}>
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
          )}
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
  tabIconContainer: {
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E53935',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  // JOB CODE CARD - Compact, subtle light blue
  jobCodeCard: {
    backgroundColor: '#EEF6FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C5DFFF',
    alignItems: 'center',
  },
  jobCodeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5B8BD4',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  jobCodeValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C5AA0',
    letterSpacing: 4,
    marginBottom: 6,
  },
  // COMPLETION OTP CARD - Green theme
  completionOtpCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A5D6A7',
    alignItems: 'center',
  },
  completionOtpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  completionOtpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  completionOtpValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1B5E20',
    letterSpacing: 6,
    marginBottom: 6,
  },
  completionOtpHint: {
    fontSize: 12,
    color: '#558B2F',
    textAlign: 'center',
  },
  jobCodeHint: {
    fontSize: 12,
    color: '#7A9BC7',
  },
  // In Progress Card - Light blue theme
  inProgressCard: {
    backgroundColor: '#EEF6FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#C5DFFF',
  },
  inProgressContent: {
    flex: 1,
  },
  inProgressTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C5AA0',
  },
  inProgressText: {
    fontSize: 12,
    color: '#7A9BC7',
    marginTop: 2,
  },
  // Summary Card
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
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  tickContainer: {
    marginLeft: 4,
  },
  ticksRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondTick: {
    marginLeft: -8,
  },
  chatClosedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
    gap: 8,
  },
  chatClosedText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
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
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E53935',
  },
});
