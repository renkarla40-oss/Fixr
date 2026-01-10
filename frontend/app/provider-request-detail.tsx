import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { getUserFriendlyError, isIdempotentSuccess, getIdempotentMessage } from '../utils/errorMessages';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  paymentStatus?: 'unpaid' | 'held';
  paidAt?: string;
  createdAt: string;
  preferredDateTime?: string;
  isGeneralRequest?: boolean;
  subCategory?: string;
  location?: string;
  jobTown?: string;
  jobCode?: string;
  jobStartedAt?: string;
  jobCompletedAt?: string;
  completionOtp?: string;
}

interface Message {
  _id: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'provider';
  type?: 'text' | 'image' | 'quote' | 'payment';
  text?: string;
  imageUrl?: string;
  quoteId?: string;
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
}

interface Quote {
  _id: string;
  requestId: string;
  customerId: string;
  providerId: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  status: 'DRAFT' | 'SENT' | 'COUNTERED' | 'REJECTED' | 'ACCEPTED' | 'VOID';
  note?: string;
  revision?: number;
  counterAmount?: number;
  counterNote?: string;
  createdAt: string;
  sentAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  counteredAt?: string;
  paidAt?: string;
}

type TabType = 'details' | 'chat';

export default function ProviderRequestDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const requestId = params.requestId as string;
  const openChat = params.openChat === 'true';

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(openChat ? 'chat' : 'details');
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  // Quote state
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteTitle, setQuoteTitle] = useState('');
  const [quoteDescription, setQuoteDescription] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteNote, setQuoteNote] = useState('');
  const [sendingQuote, setSendingQuote] = useState(false);
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [reviseAmount, setReviseAmount] = useState('');
  const [reviseNote, setReviseNote] = useState('');

  // Job code entry
  const [jobCodeInput, setJobCodeInput] = useState('');
  const [confirmingArrival, setConfirmingArrival] = useState(false);
  
  // Completion OTP entry
  const [completionOtpInput, setCompletionOtpInput] = useState('');
  const [showCompletionOtpInput, setShowCompletionOtpInput] = useState(false);
  const [completingJob, setCompletingJob] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const unreadPollingRef = useRef<NodeJS.Timeout | null>(null);
  const statusPollingRef = useRef<NodeJS.Timeout | null>(null);
  const prevMessageCountRef = useRef<number>(0); // Track previous message count for scroll logic

  // Calculate bottom spacing to clear tab bar + system nav
  const bottomTabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom + (Platform.OS === 'android' ? 20 : 8);

  // Refetch on screen focus to get latest status from database
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
  // This ensures provider sees payment confirmation in real-time
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

  // Tab-based message and unread polling - MATCHES CUSTOMER CHAT PATTERN EXACTLY
  useEffect(() => {
    if (activeTab === 'chat' && request) {
      // Mark messages as read when opening chat tab
      setHasUnreadMessages(false);
      fetchMessages();
      fetchQuote(); // Fetch latest quote for this request
      // Mark messages as read on server, then refresh to get updated readAt
      markMessagesAsRead().then(() => {
        // Refresh messages to show updated read status (blue ticks)
        fetchMessagesQuietly();
      });
      
      // Start polling every 2 seconds when chat is active
      pollingIntervalRef.current = setInterval(() => {
        fetchMessagesQuietly();
        fetchQuote(); // Poll for quote updates too
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

  // Mark all messages from the other user (customer) as read
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

  // MATCHES CUSTOMER CHAT EXACTLY - smart update to prevent re-render flicker
  const fetchMessages = async (showLoading = true) => {
    if (!request?._id) return;
    
    // Only show loading on first fetch, not on subsequent polls
    if (showLoading && messages.length === 0) {
      setLoadingMessages(true);
    }
    try {
      const response = await axios.get(`${BACKEND_URL}/api/service-requests/${request._id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const newMessages: Message[] = response.data.messages || [];
      
      // Update messages state
      setMessages(newMessages);
      
      // SCROLL LOGIC: Only scroll when new messages arrive (count increases)
      // Never scroll on initial load or when empty
      if (newMessages.length > 0 && newMessages.length > prevMessageCountRef.current && prevMessageCountRef.current > 0) {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
      
      // Update prev count ref AFTER render
      prevMessageCountRef.current = newMessages.length;
    } catch (err) {
      console.log('Messages fetch error');
    } finally {
      setLoadingMessages(false);
    }
  };

  // Quiet fetch for polling - no loading state, only updates on real changes
  // MATCHES CUSTOMER CHAT EXACTLY
  const fetchMessagesQuietly = async () => {
    if (!request?._id) return;
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/service-requests/${request._id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const newMessages: Message[] = response.data.messages || [];
      
      // Only update if message count changed
      if (newMessages.length !== prevMessageCountRef.current) {
        setMessages(newMessages);
        
        // Scroll only when NEW messages arrive (not on decrease/same)
        if (newMessages.length > prevMessageCountRef.current && prevMessageCountRef.current > 0) {
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
        
        prevMessageCountRef.current = newMessages.length;
      }
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
      
      // Find messages from the OTHER user (customer) that haven't been read (readAt is null)
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
      senderRole: 'provider',
      type: 'text',
      text: messageText,
      createdAt: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    
    
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

  // Image picker and upload for provider
  const handlePickImage = async () => {
    if (request?.status === 'completed') {
      Alert.alert('Chat Closed', 'Chat is read-only after job completion.');
      return;
    }

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
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('file', {
        uri: imageUri,
        name: filename,
        type,
      } as any);

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

      await axios.post(
        `${BACKEND_URL}/api/service-requests/${request._id}/messages`,
        { type: 'image', imageUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      fetchMessagesQuietly();
      
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

  // Quote functions
  const fetchQuote = async () => {
    if (!request?._id) return;
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/quotes/by-request/${request._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.quote) {
        setCurrentQuote(response.data.quote);
      }
    } catch (err) {
      // No quote yet - that's fine
    }
  };

  const handleSendQuote = async () => {
    if (!request?._id || !quoteTitle.trim() || !quoteAmount) return;
    
    const amount = parseFloat(quoteAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    
    setSendingQuote(true);
    try {
      // Create the quote
      const createResponse = await axios.post(
        `${BACKEND_URL}/api/quotes`,
        {
          requestId: request._id,
          title: quoteTitle.trim(),
          description: quoteDescription.trim(),
          amount: amount,
          note: quoteNote.trim() || undefined,
          currency: 'TTD',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const quoteId = createResponse.data.quote._id;
      
      // Send the quote
      const sendResponse = await axios.post(
        `${BACKEND_URL}/api/quotes/${quoteId}/send`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setCurrentQuote(sendResponse.data.quote);
      setShowQuoteModal(false);
      setQuoteTitle('');
      setQuoteDescription('');
      setQuoteAmount('');
      setQuoteNote('');
      
      // Refresh request and messages
      fetchRequestDetail();
      fetchMessagesQuietly();
      
      Alert.alert('Success', 'Quote sent to customer!');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to send quote.';
      Alert.alert('Error', errorMsg);
    } finally {
      setSendingQuote(false);
    }
  };

  // Open revise modal with current quote values
  const openReviseModal = () => {
    if (currentQuote) {
      setReviseAmount(currentQuote.amount.toString());
      setReviseNote(currentQuote.note || '');
      setShowReviseModal(true);
    }
  };

  // Revise and resend quote
  const handleReviseAndResend = async () => {
    if (!currentQuote) return;
    
    const amount = parseFloat(reviseAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    
    setSendingQuote(true);
    try {
      // Revise the quote
      await axios.patch(
        `${BACKEND_URL}/api/quotes/${currentQuote._id}/revise`,
        {
          amount: amount,
          note: reviseNote.trim() || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Resend the quote
      const sendResponse = await axios.post(
        `${BACKEND_URL}/api/quotes/${currentQuote._id}/send`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setCurrentQuote(sendResponse.data.quote);
      setShowReviseModal(false);
      setReviseAmount('');
      setReviseNote('');
      
      // Refresh messages
      fetchMessagesQuietly();
      
      Alert.alert('Success', 'Revised quote sent to customer!');
    } catch (err: any) {
      Alert.alert('Error', getUserFriendlyError(err, 'Failed to revise and resend quote.'));
    } finally {
      setSendingQuote(false);
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
      // Immediately re-fetch to update local state with latest from DB
      await fetchRequestDetail();
      Alert.alert(
        'Success',
        `Request ${action === 'accept' ? 'accepted' : 'declined'} successfully!`
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
      const response = await axios.post(
        `${BACKEND_URL}/api/service-requests/${request._id}/confirm-arrival`,
        { jobCode: jobCodeInput.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Handle idempotent success (already started)
      if (isIdempotentSuccess(response)) {
        Alert.alert('Info', getIdempotentMessage(response));
      } else {
        Alert.alert('Success', 'Job started successfully!');
      }
      setJobCodeInput('');
      fetchRequestDetail();
    } catch (err: any) {
      Alert.alert('Error', getUserFriendlyError(err, "That code doesn't match. Please try again."));
    } finally {
      setConfirmingArrival(false);
    }
  };

  const handleCompleteJob = () => {
    // Show OTP input section instead of completing directly
    setShowCompletionOtpInput(true);
    setCompletionOtpInput('');
  };
  
  const handleConfirmCompletion = async () => {
    if (!request?._id || !completionOtpInput.trim()) return;
    
    setCompletingJob(true);
    try {
      const response = await axios.patch(
        `${BACKEND_URL}/api/service-requests/${request._id}/complete`,
        { completionOtp: completionOtpInput.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Handle idempotent success (already completed)
      if (isIdempotentSuccess(response)) {
        Alert.alert('Info', getIdempotentMessage(response));
      } else {
        Alert.alert('Success', 'Job completed successfully!');
      }
      setShowCompletionOtpInput(false);
      setCompletionOtpInput('');
      await fetchRequestDetail();
    } catch (err: any) {
      Alert.alert('Error', getUserFriendlyError(err, "That code doesn't match. Please try again."));
    } finally {
      setCompletingJob(false);
    }
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
      case 'paid':
        return { bg: '#E8F5E9', text: '#2E7D32', icon: 'card', label: 'Paid' };
      case 'in_progress':
        return { bg: '#E3F2FD', text: '#1565C0', icon: 'play-circle', label: 'In Progress' };
      case 'completed':
        return { bg: '#F3E5F5', text: '#7B1FA2', icon: 'checkmark-done-circle', label: 'Completed' };
      case 'declined':
        return { bg: '#FFEBEE', text: '#C62828', icon: 'close-circle', label: 'Declined' };
      case 'cancelled':
        return { bg: '#FFF3E0', text: '#E65100', icon: 'close-circle-outline', label: 'Cancelled' };
      default:
        return { bg: '#EAF3FF', text: '#4A7DC4', icon: 'time', label: 'Pending Review' };
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
          <Text style={styles.title}>Job Details</Text>
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
          <Text style={styles.title}>Job Details</Text>
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
          <Text style={styles.title}>Job Details</Text>
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
        <KeyboardAvoidingView 
          style={styles.detailsContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.contentContainer, 
              { paddingBottom: isPending ? 100 : bottomTabBarHeight + 16 }
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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

            {/* Job Code Entry - Show for accepted and paid status */}
            {(request.status === 'accepted' || request.status === 'paid') && (
              <View style={styles.jobCodeSection}>
                <Text style={styles.jobCodeLabel}>
                  {request.status === 'paid' ? 'Payment Received! Start Job' : 'Enter Job Code'}
                </Text>
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

            {/* Finish Job Button and OTP Input - MOVED UP for visibility (when in_progress) */}
            {request.status === 'in_progress' && (
              <View style={styles.finishJobSection}>
                {!showCompletionOtpInput ? (
                  <TouchableOpacity style={styles.finishJobButton} onPress={handleCompleteJob}>
                    <Ionicons name="checkmark-done-circle" size={22} color="#FFFFFF" />
                    <Text style={styles.finishJobButtonText}>Finish Job</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.completionOtpSection}>
                    <View style={styles.completionOtpHeader}>
                      <Ionicons name="key" size={20} color="#4CAF50" />
                      <Text style={styles.completionOtpTitle}>Enter Completion OTP</Text>
                    </View>
                    <Text style={styles.completionOtpHint}>Ask the customer for the 6-digit completion code</Text>
                    <TextInput
                      style={styles.completionOtpInput}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor="#A5D6A7"
                      value={completionOtpInput}
                      onChangeText={setCompletionOtpInput}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <View style={styles.completionOtpButtons}>
                      <TouchableOpacity
                        style={styles.cancelOtpButton}
                        onPress={() => {
                          setShowCompletionOtpInput(false);
                          setCompletionOtpInput('');
                        }}
                      >
                        <Text style={styles.cancelOtpButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.confirmCompletionButton, completionOtpInput.length !== 6 && styles.buttonDisabled]}
                        onPress={handleConfirmCompletion}
                        disabled={completionOtpInput.length !== 6 || completingJob}
                      >
                        {completingJob ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.confirmCompletionButtonText}>Confirm & Complete</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

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
          </ScrollView>

          {/* FIXED ACTION BUTTONS AT BOTTOM - Only for pending requests */}
          {isPending && (
            <View style={[styles.fixedActionBar, { paddingBottom: insets.bottom + 12 }]}>
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
        </KeyboardAvoidingView>
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
                const isMine = msg.senderId === user?._id;
                const isSystem = msg.type === 'system' || msg.senderRole === 'system';
                const isImage = (msg.type === 'image' || msg.imageUrl) && msg.imageUrl;
                const imageUri = isImage ? `${BACKEND_URL}${msg.imageUrl}` : '';
                
                // Render system messages with special centered styling
                if (isSystem) {
                  return (
                    <View key={msg._id} style={styles.systemMessageContainer}>
                      <View style={styles.systemMessageBubble}>
                        <Text style={styles.systemMessageText}>{msg.text}</Text>
                      </View>
                    </View>
                  );
                }
                
                return (
                  <View key={msg._id} style={[styles.messageBubble, isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs, isImage && styles.imageBubble]}>
                    {!isMine && <Text style={styles.messageSender}>{msg.senderName}</Text>}
                    {isImage ? (
                      <TouchableOpacity 
                        onPress={() => setFullScreenImage(imageUri)}
                        style={styles.chatImageContainer}
                        activeOpacity={0.9}
                      >
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.chatImage}
                          resizeMode="cover"
                        />
                        <View style={styles.imageOverlay}>
                          <Ionicons name="expand-outline" size={18} color="rgba(255,255,255,0.9)" />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <Text style={[styles.messageText, isMine && styles.messageTextMine]}>{msg.text}</Text>
                    )}
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
            <View style={{ paddingBottom: insets.bottom + 12 }}>
              {/* Send Quote Button - only for accepted status before payment */}
              {(request.status === 'accepted' || request.status === 'awaiting_payment') && (!currentQuote || currentQuote.status === 'VOID') && (
                <TouchableOpacity
                  style={styles.sendQuoteButton}
                  onPress={() => setShowQuoteModal(true)}
                >
                  <Ionicons name="document-text" size={20} color="#FFFFFF" />
                  <Text style={styles.sendQuoteButtonText}>Send Quote</Text>
                </TouchableOpacity>
              )}
              {/* Quote Status Banner - SENT */}
              {currentQuote && currentQuote.status === 'SENT' && (
                <View style={styles.quotePendingBanner}>
                  <Ionicons name="time-outline" size={16} color="#F57C00" />
                  <Text style={styles.quotePendingText}>
                    {currentQuote.revision && currentQuote.revision > 1 
                      ? `Revised quote #${currentQuote.revision} sent • Waiting for customer` 
                      : 'Quote sent • Waiting for customer'}
                  </Text>
                </View>
              )}

              {/* Quote Status Banner - REJECTED (needs revision) */}
              {currentQuote && currentQuote.status === 'REJECTED' && (
                <View style={styles.quoteRejectedBanner}>
                  <View style={styles.quoteRejectedHeader}>
                    <Ionicons name="close-circle" size={18} color="#E53935" />
                    <Text style={styles.quoteRejectedTitle}>Quote Rejected</Text>
                  </View>
                  <Text style={styles.quoteRejectedSubtext}>
                    Your quote of ${currentQuote.amount.toFixed(2)} was rejected
                  </Text>
                  <TouchableOpacity
                    style={styles.reviseQuoteButton}
                    onPress={openReviseModal}
                    disabled={sendingQuote}
                  >
                    <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.reviseQuoteButtonText}>Revise & Resend Quote</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Quote Status Banner - COUNTERED (needs revision) */}
              {currentQuote && currentQuote.status === 'COUNTERED' && (
                <View style={styles.quoteCounteredBanner}>
                  <View style={styles.quoteCounteredHeader}>
                    <Ionicons name="swap-horizontal" size={18} color="#FF9800" />
                    <Text style={styles.quoteCounteredTitle}>Counter Offer Received</Text>
                  </View>
                  <View style={styles.counterOfferDetails}>
                    <View style={styles.counterOfferAmountRow}>
                      <Text style={styles.counterOfferLabel}>Your quote:</Text>
                      <Text style={styles.counterOfferOriginalAmount}>${currentQuote.amount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.counterOfferAmountRow}>
                      <Text style={styles.counterOfferLabel}>Counter offer:</Text>
                      <Text style={styles.counterOfferNewAmount}>${currentQuote.counterAmount?.toFixed(2)}</Text>
                    </View>
                    {currentQuote.counterNote && (
                      <Text style={styles.counterOfferNoteText}>"{currentQuote.counterNote}"</Text>
                    )}
                  </View>
                  <View style={styles.counterOfferActions}>
                    <TouchableOpacity
                      style={styles.acceptCounterButton}
                      onPress={() => {
                        // Accept the counter by revising to their amount and resending
                        setReviseAmount(currentQuote.counterAmount?.toString() || '');
                        setReviseNote('Accepted your counter offer');
                        setShowReviseModal(true);
                      }}
                      disabled={sendingQuote}
                    >
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      <Text style={styles.acceptCounterButtonText}>Accept Counter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.reviseQuoteButtonAlt}
                      onPress={openReviseModal}
                      disabled={sendingQuote}
                    >
                      <Ionicons name="create-outline" size={18} color="#1976D2" />
                      <Text style={styles.reviseQuoteButtonAltText}>Make New Offer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Quote Status Banner - ACCEPTED (awaiting payment) */}
              {currentQuote && currentQuote.status === 'ACCEPTED' && !request.paidAt && (
                <View style={styles.quoteAcceptedBanner}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  <Text style={styles.quoteAcceptedText}>Quote accepted • Waiting for customer to pay</Text>
                </View>
              )}

              {/* Payment Confirmed - Inline Job Code Entry */}
              {request.status === 'awaiting_payment' && request.paymentStatus === 'held' && (
                <View style={styles.paidJobCodeSection}>
                  <View style={styles.paidJobCodeHeader}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.paidJobCodeTitle}>Payment Secured!</Text>
                  </View>
                  <Text style={styles.paidJobCodeHint}>Ask the customer for the 6-digit code to start</Text>
                  <View style={styles.paidJobCodeInputRow}>
                    <TextInput
                      style={styles.paidJobCodeInput}
                      placeholder="000000"
                      placeholderTextColor="#A5D6A7"
                      value={jobCodeInput}
                      onChangeText={setJobCodeInput}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <TouchableOpacity
                      style={[styles.paidStartJobButton, (!jobCodeInput.trim() || confirmingArrival) && styles.paidStartJobButtonDisabled]}
                      onPress={handleConfirmArrival}
                      disabled={!jobCodeInput.trim() || confirmingArrival}
                    >
                      {confirmingArrival ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="play" size={18} color="#FFFFFF" />
                          <Text style={styles.paidStartJobButtonText}>Start Job</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <View style={styles.messageInputContainer}>
                {/* Image upload button */}
                <TouchableOpacity
                  style={styles.imagePickerButton}
                  onPress={showImageOptions}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color="#E53935" />
                  ) : (
                    <Ionicons name="camera" size={24} color="#E53935" />
                  )}
                </TouchableOpacity>
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
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      {/* Full Screen Image Modal */}
      <Modal
        visible={!!fullScreenImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullScreenImage(null)}
      >
        <View style={styles.fullScreenImageContainer}>
          <TouchableOpacity
            style={styles.fullScreenCloseButton}
            onPress={() => setFullScreenImage(null)}
          >
            <Ionicons name="close" size={32} color="#FFFFFF" />
          </TouchableOpacity>
          {fullScreenImage && (
            <Image
              source={{ uri: fullScreenImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Send Quote Modal */}
      <Modal
        visible={showQuoteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQuoteModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.quoteModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.quoteModalContent}>
            <View style={styles.quoteModalHeader}>
              <Text style={styles.quoteModalTitle}>Send Quote</Text>
              <TouchableOpacity onPress={() => setShowQuoteModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.quoteFormGroup}>
              <Text style={styles.quoteFormLabel}>Title</Text>
              <TextInput
                style={styles.quoteFormInput}
                placeholder="e.g., Deep Cleaning Service"
                placeholderTextColor="#999"
                value={quoteTitle}
                onChangeText={setQuoteTitle}
                maxLength={100}
              />
            </View>
            
            <View style={styles.quoteFormGroup}>
              <Text style={styles.quoteFormLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.quoteFormInput, styles.quoteFormTextArea]}
                placeholder="Work details, materials included, etc."
                placeholderTextColor="#999"
                value={quoteDescription}
                onChangeText={setQuoteDescription}
                multiline
                maxLength={500}
              />
            </View>
            
            <View style={styles.quoteFormGroup}>
              <Text style={styles.quoteFormLabel}>Amount (TTD)</Text>
              <View style={styles.quoteAmountRow}>
                <Text style={styles.quoteCurrency}>$</Text>
                <TextInput
                  style={styles.quoteAmountInput}
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  value={quoteAmount}
                  onChangeText={setQuoteAmount}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.quoteFormGroup}>
              <Text style={styles.quoteFormLabel}>Note (optional)</Text>
              <TextInput
                style={[styles.quoteFormInput, styles.quoteFormTextArea]}
                placeholder="Additional notes for the customer"
                placeholderTextColor="#999"
                value={quoteNote}
                onChangeText={setQuoteNote}
                multiline
                maxLength={500}
              />
            </View>
            
            <TouchableOpacity
              style={[styles.quoteSubmitButton, (!quoteTitle.trim() || !quoteAmount) && styles.quoteSubmitButtonDisabled]}
              onPress={handleSendQuote}
              disabled={!quoteTitle.trim() || !quoteAmount || sendingQuote}
            >
              {sendingQuote ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.quoteSubmitButtonText}>Send Quote to Customer</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Revise Quote Modal */}
      <Modal
        visible={showReviseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReviseModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.quoteModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.quoteModalContent}>
            <View style={styles.quoteModalHeader}>
              <Text style={styles.quoteModalTitle}>Revise Quote</Text>
              <TouchableOpacity onPress={() => setShowReviseModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {currentQuote && (
              <View style={styles.reviseOriginalInfo}>
                <Text style={styles.reviseOriginalLabel}>Original Quote:</Text>
                <Text style={styles.reviseOriginalTitle}>{currentQuote.title}</Text>
                <Text style={styles.reviseOriginalAmount}>${currentQuote.amount.toFixed(2)}</Text>
                {currentQuote.counterAmount && (
                  <View style={styles.reviseCounterInfo}>
                    <Text style={styles.reviseCounterLabel}>Customer's counter offer:</Text>
                    <Text style={styles.reviseCounterAmount}>${currentQuote.counterAmount.toFixed(2)}</Text>
                  </View>
                )}
              </View>
            )}
            
            <View style={styles.quoteFormGroup}>
              <Text style={styles.quoteFormLabel}>New Amount (TTD)</Text>
              <View style={styles.quoteAmountRow}>
                <Text style={styles.quoteCurrency}>$</Text>
                <TextInput
                  style={styles.quoteAmountInput}
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  value={reviseAmount}
                  onChangeText={setReviseAmount}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.quoteFormGroup}>
              <Text style={styles.quoteFormLabel}>Note (optional)</Text>
              <TextInput
                style={[styles.quoteFormInput, styles.quoteFormTextArea]}
                placeholder="Explain the revision..."
                placeholderTextColor="#999"
                value={reviseNote}
                onChangeText={setReviseNote}
                multiline
                maxLength={500}
              />
            </View>
            
            <TouchableOpacity
              style={[styles.quoteSubmitButton, !reviseAmount && styles.quoteSubmitButtonDisabled]}
              onPress={handleReviseAndResend}
              disabled={!reviseAmount || sendingQuote}
            >
              {sendingQuote ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.quoteSubmitButtonText}>Send Revised Quote</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  tabIconContainer: {
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E53935',
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
  // Job Code Section - Light blue theme
  jobCodeSection: {
    backgroundColor: '#EEF6FF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C5DFFF',
  },
  jobCodeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5B8BD4',
    marginBottom: 2,
  },
  jobCodeHint: {
    fontSize: 11,
    color: '#7A9BC7',
    marginBottom: 10,
  },
  jobCodeInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  jobCodeInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C5DFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 4,
    color: '#2C5AA0',
  },
  startJobButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  startJobButtonDisabled: {
    backgroundColor: '#B8D4F0',
  },
  startJobButtonText: {
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
  // Finish Job Section
  finishJobSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  finishJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  finishJobButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  completionOtpSection: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  completionOtpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  completionOtpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  completionOtpHint: {
    fontSize: 13,
    color: '#558B2F',
    marginBottom: 12,
  },
  completionOtpInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: '#A5D6A7',
    marginBottom: 12,
  },
  completionOtpButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelOtpButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#999',
    alignItems: 'center',
  },
  cancelOtpButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmCompletionButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  confirmCompletionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
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
    minHeight: 200,
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
  // System message styles - centered completion notice
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  systemMessageBubble: {
    backgroundColor: '#F0F4F8',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E0E7EF',
  },
  systemMessageText: {
    fontSize: 14,
    color: '#5A6978',
    textAlign: 'center',
    fontWeight: '500',
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
  // Image message styles
  imagePickerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageBubble: {
    padding: 4,
    maxWidth: '75%',
  },
  chatImageContainer: {
    width: 200,
    height: 180,
    maxHeight: 220,
    backgroundColor: '#E0E0E0',
    borderRadius: 14,
    overflow: 'hidden',
  },
  chatImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    padding: 4,
  },
  fullScreenImageContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.2,
  },
  // Quote styles
  sendQuoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  sendQuoteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  quotePendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  quotePendingText: {
    color: '#F57C00',
    fontSize: 13,
    fontWeight: '500',
  },
  // Quote Rejected Banner
  quoteRejectedBanner: {
    backgroundColor: '#FFEBEE',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  quoteRejectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  quoteRejectedTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#C62828',
  },
  quoteRejectedSubtext: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  reviseQuoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  reviseQuoteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Quote Countered Banner
  quoteCounteredBanner: {
    backgroundColor: '#FFF8E1',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  quoteCounteredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  quoteCounteredTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E65100',
  },
  counterOfferDetails: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  counterOfferAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  counterOfferLabel: {
    fontSize: 13,
    color: '#666',
  },
  counterOfferOriginalAmount: {
    fontSize: 13,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  counterOfferNewAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9800',
  },
  counterOfferNoteText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  counterOfferActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptCounterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  acceptCounterButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  reviseQuoteButtonAlt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1976D2',
    gap: 6,
  },
  reviseQuoteButtonAltText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },
  // Quote Accepted Banner
  quoteAcceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  quoteAcceptedText: {
    color: '#2E7D32',
    fontSize: 13,
    fontWeight: '500',
  },
  // Revise Modal Styles
  reviseOriginalInfo: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  reviseOriginalLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  reviseOriginalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  reviseOriginalAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    textDecorationLine: 'line-through',
    marginTop: 4,
  },
  reviseCounterInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  reviseCounterLabel: {
    fontSize: 12,
    color: '#FF9800',
    marginBottom: 4,
  },
  reviseCounterAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF9800',
  },
  paymentConfirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  paymentConfirmedText: {
    color: '#2E7D32',
    fontSize: 13,
    fontWeight: '500',
  },
  // Inline Job Code Entry for Paid status
  paidJobCodeSection: {
    backgroundColor: '#E8F5E9',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  paidJobCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  paidJobCodeTitle: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '700',
  },
  paidJobCodeHint: {
    color: '#558B2F',
    fontSize: 13,
    marginBottom: 12,
  },
  paidJobCodeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paidJobCodeInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A5D6A7',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '600',
    color: '#2E7D32',
    letterSpacing: 4,
    textAlign: 'center',
  },
  paidStartJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  paidStartJobButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  paidStartJobButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  quoteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  quoteModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  quoteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  quoteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  quoteFormGroup: {
    marginBottom: 16,
  },
  quoteFormLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  quoteFormInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1A1A1A',
  },
  quoteFormTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  quoteAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  quoteCurrency: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginRight: 4,
  },
  quoteAmountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    paddingVertical: 14,
  },
  quoteSubmitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  quoteSubmitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  quoteSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
