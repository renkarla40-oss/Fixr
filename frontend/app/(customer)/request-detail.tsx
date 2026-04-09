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
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { api, formatApiError } from '../../utils/apiClient';
import {
  getCachedData,
  setCachedData,
  shouldRefetch,
  markFetchStarted,
  cancelRequest,
  createTimingTracker,
  isRequestInFlight,
  setRequestInFlight,
  isInBackoff,
  setBackoff,
  clearBackoff,
  CACHE_KEYS,
} from '../../utils/screenCache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { getServiceLabel } from '../../constants/serviceCategories';
import { getUserFriendlyError, isIdempotentSuccess, getIdempotentMessage } from '../../utils/errorMessages';
import { getEffectiveStatus as getEffectiveStatusShared } from '../../constants/statusStyles';

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
  paymentStatus?: 'unpaid' | 'held';
  paidAt?: string;
  createdAt: string;
  preferredDateTime?: string;
  subCategory?: string;
  location?: string;
  jobTown?: string;
  jobCode?: string;
  startedAt?: string;
  completedAt?: string;
  jobStartedAt?: string;
  jobCompletedAt?: string;
  completionOtp?: string;
  customerRating?: number;
  customerReview?: string;
  // Per-user unread tracking fields
  last_message_at?: string;
  customer_last_read_at?: string;
}

interface Message {
  _id: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'provider' | 'system';
  type?: 'text' | 'image' | 'quote' | 'payment' | 'system';
  text?: string;
  imageUrl?: string;
  quoteId?: string;
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
  targetRole?: 'customer' | 'provider';
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
  // Provider rating info
  providerName?: string;
  providerRating?: number;
  providerReviewCount?: number;
}

type TabType = 'details' | 'chat';

export default function RequestDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const requestId = params.requestId as string;
  
  // INSTANT NAVIGATION: Get cached data for this specific request
  const cacheKey = CACHE_KEYS.CUSTOMER_REQUEST_DETAIL(requestId || '');
  const cachedData = requestId ? getCachedData<ServiceRequest>(cacheKey) : null;
  
  const [request, setRequest] = useState<ServiceRequest | null>(cachedData);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(!cachedData); // Only show loading if no cache
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Performance timing
  const timingRef = useRef(createTimingTracker('Customer Request Details'));
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  
  // Quote state
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [processingQuoteAction, setProcessingQuoteAction] = useState(false);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterNote, setCounterNote] = useState('');
  
  // Review state
  const [existingReview, setExistingReview] = useState<{rating: number; comment?: string} | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  
  // Payment status state (PRIMARY AUTHORITY for paid state)
  const [paymentRecord, setPaymentRecord] = useState<{
    paymentId: string | null;
    status: string | null;
    amount: number | null;
    currency: string | null;
    gateway: string | null;
  } | null>(null);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const unreadPollingRef = useRef<NodeJS.Timeout | null>(null);
  const statusPollingRef = useRef<NodeJS.Timeout | null>(null); // Lightweight polling for pending status
  const prevMessageCountRef = useRef<number>(0); // Track previous message count for scroll logic
  const hasAutoNavigatedToReviewRef = useRef<boolean>(false); // Prevent auto-nav loops
  const previousStatusRef = useRef<string | null>(null); // Track status transitions
  const fetchCounterRef = useRef<number>(0); // STABILITY: Stale response protection
  const lastRequestIdRef = useRef<string | null>(null); // Track requestId to detect changes

  // Calculate bottom spacing to clear tab bar + system nav
  const bottomTabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom + (Platform.OS === 'android' ? 20 : 8);

  // CRITICAL FIX: Reset ALL state when requestId changes (navigating to different job)
  useEffect(() => {
    if (requestId && requestId !== lastRequestIdRef.current) {
      // Reset state for new job
      lastRequestIdRef.current = requestId;
      setRequest(null);
      setMessages([]);
      setLoading(true);
      setLoadingMessages(false);
      setError(null);
      setCurrentQuote(null);
      setActiveTab('details');
      setHasUnreadMessages(false);
      setExistingReview(null);
      setPaymentRecord(null);
      hasAutoNavigatedToReviewRef.current = false;
      previousStatusRef.current = null;
      fetchCounterRef.current = 0;
      prevMessageCountRef.current = 0;
    }
  }, [requestId]);

  // Fetch request detail on mount and screen focus WITH COOLDOWN
  useFocusEffect(
    useCallback(() => {
      // Log first render timing
      timingRef.current.logFirstRender();
      
      // Check cooldown before refetching
      if (requestId && shouldRefetch(cacheKey)) {
        fetchRequestDetail();
      } else if (cachedData) {
        // Use cached data, skip fetch
        setLoading(false);
      }
      
      // Cleanup on unfocus - cancel pending requests
      return () => {
        cancelRequest(cacheKey);
      };
    }, [requestId, token])
  );

  // LIGHTWEIGHT STATUS POLLING: Only for 'pending' requests while screen is focused
  // This allows customer to see when provider accepts without navigating away
  useEffect(() => {
    // Only poll if status is 'pending' - stop for any other status
    if (request?.status === 'pending' && requestId && token) {
      // Start polling every 5 seconds
      statusPollingRef.current = setInterval(() => {
        fetchRequestDetailQuietly();
      }, 5000);
    } else {
      // Stop polling - status is no longer pending
      if (statusPollingRef.current) {
        clearInterval(statusPollingRef.current);
        statusPollingRef.current = null;
      }
    }
    
    return () => {
      if (statusPollingRef.current) {
        clearInterval(statusPollingRef.current);
        statusPollingRef.current = null;
      }
    };
  }, [request?.status, requestId, token]);

  // Fetch existing review when request is loaded and completed
  useEffect(() => {
    // Check for review in any completed state
    const completedStates = ['completed', 'completed_pending_review', 'completed_reviewed'];
    if (request?._id && completedStates.includes(request?.status || '')) {
      fetchExistingReview();
    }
  }, [request?.status, request?._id]);

  // AUTO-NAVIGATE to Leave Review screen when job status transitions to 'completed_pending_review'
  // Only triggers on actual status CHANGE (not on initial load)
  useEffect(() => {
    if (!request?._id || !request?.status) return;
    
    const currentStatus = request.status;
    const prevStatus = previousStatusRef.current;
    
    // Update previous status
    previousStatusRef.current = currentStatus;
    
    // Only navigate if:
    // 1. Status just changed TO 'completed_pending_review' (was 'in_progress' before)
    // 2. We haven't already auto-navigated for this session
    // 3. No existing review already submitted
    const isStatusTransitionToCompletedPendingReview = 
      prevStatus !== null && 
      prevStatus === 'in_progress' && 
      currentStatus === 'completed_pending_review';
    
    if (isStatusTransitionToCompletedPendingReview && !hasAutoNavigatedToReviewRef.current && !existingReview) {
      // Mark as navigated to prevent loops
      hasAutoNavigatedToReviewRef.current = true;
      
      // Small delay to let the UI settle and show "completed" state briefly
      setTimeout(() => {
        router.push({ pathname: '/leave-review', params: { requestId: request._id } });
      }, 500);
    }
  }, [request?.status, request?._id, existingReview]);

  // STABILITY: Removed aggressive continuous polling - now only refreshes on focus
  // Status updates will come from useFocusEffect and pull-to-refresh
  
  // Tab-based logic with FOCUS-SCOPED POLLING for real-time updates
  useEffect(() => {
    if (activeTab === 'chat' && request) {
      // Set loading immediately to prevent "No messages" flash
      setLoadingMessages(true);
      // Mark messages as read when opening chat tab
      setHasUnreadMessages(false);
      fetchMessages();
      fetchQuote(); // Fetch latest quote for customer
      // Mark messages as read on server, then refresh once
      markMessagesAsRead().then(() => {
        fetchMessagesQuietly();
        fetchRequestDetailQuietly();
      });
      
      // FOCUS-SCOPED POLLING: Poll messages every 3 seconds while chat is active
      pollingIntervalRef.current = setInterval(() => {
        fetchMessagesQuietly();
        fetchQuote(); // Check for new quotes
        fetchRequestDetailQuietly(); // Keep status + timestamps in sync
      }, 3000);
      
    } else if (activeTab === 'details' && request) {
      // Check for unread messages using per-user timestamp tracking
      checkForUnreadMessages();
      
      // FOCUS-SCOPED POLLING: Poll request status every 5 seconds for active states
      const activeStates = ['pending', 'accepted', 'awaiting_payment', 'in_progress'];
      if (activeStates.includes(request.status)) {
        unreadPollingRef.current = setInterval(() => {
          fetchRequestDetailQuietly();
        }, 5000);
      }
    }
    
    // Cleanup polling on tab change or unmount (STOP ON BLUR)
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
  }, [activeTab, request?._id, request?.status]);

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
    // SINGLE-FLIGHT: Skip if already fetching
    if (isRequestInFlight(cacheKey)) {
      console.log('[FETCH] Customer Request Details skip (already in-flight)');
      return;
    }
    
    // BACKOFF: Skip if in backoff period
    if (isInBackoff(cacheKey)) {
      console.log('[FETCH] Customer Request Details skip (in backoff)');
      return;
    }
    
    // STABILITY: Stale response protection
    const thisFetch = ++fetchCounterRef.current;
    
    console.log('[NAV] Customer Request Details focused');
    console.log('[FETCH] Customer Request Details start');
    
    // Mark fetch started
    setRequestInFlight(cacheKey, true);
    markFetchStarted(cacheKey);
    
    try {
      const response = await api.get(`${BACKEND_URL}/api/service-requests/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` },
        actionName: 'Load Request Details',
      });
      
      // Only update state if this is still the latest fetch
      if (thisFetch !== fetchCounterRef.current) return;
      
      if (response.success && response.data) {
        setRequest(response.data);
        setCachedData(cacheKey, response.data);
        clearBackoff(cacheKey);
        setError(null);
        console.log('[FETCH] Customer Request Details success');
        timingRef.current.logDataLoaded();
      } else if (response.error) {
        if (response.error.statusCode === 429) {
          setBackoff(cacheKey, 1);
        }
        // Only show error if no existing data
        if (!request) {
          setError(formatApiError(response.error));
        }
        console.log(`[FETCH] Customer Request Details failed ${response.error.statusCode || 'unknown'}`);
      }
    } catch (err: any) {
      // Only update state if this is still the latest fetch
      if (thisFetch !== fetchCounterRef.current) return;
      
      console.log('[FETCH] Customer Request Details failed (exception)');
      if (!request) {
        setError('Unable to load request details. Please try again.');
      }
    } finally {
      setRequestInFlight(cacheKey, false);
      if (thisFetch === fetchCounterRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Quiet version for polling - does NOT set error state to avoid UI flash
  const fetchRequestDetailQuietly = async () => {
    if (!requestId || !token) return;
    try {
      const response = await axios.get(`${BACKEND_URL}/api/service-requests/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequest(response.data);
    } catch (err) {
      // Silent fail for polling - keep existing data
    }
  };

  // Fetch payment record from Payments table (PRIMARY AUTHORITY for paid state)
  const fetchPaymentStatus = async () => {
    if (!requestId || !token) return;
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/payments/by-job?jobId=${requestId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPaymentRecord(response.data);
    } catch (err) {
      // Silent fail - fallback to legacy fields
      console.log('[Payment] Failed to fetch payment status, using legacy fallback');
    }
  };

  // Helper: Determine if job is PAID using payments.status as PRIMARY authority
  // Falls back to legacy fields (request.paymentStatus, currentQuote.paidAt) for backward compatibility
  const isPaid = (): boolean => {
    // PRIMARY: Check payments.status from Payments table
    if (paymentRecord?.status === 'paid') {
      return true;
    }
    // FALLBACK (legacy): Check request.paymentStatus or quote.paidAt
    if (request?.paymentStatus === 'held') {
      return true;
    }
    if (currentQuote?.paidAt) {
      return true;
    }
    return false;
  };

  // Fetch payment status when requestId changes
  useEffect(() => {
    if (requestId && token) {
      fetchPaymentStatus();
    }
  }, [requestId, token]);

  const fetchMessages = async (showLoading = true) => {
    if (!request?._id) return;
    
    // Only show loading on first fetch, not on subsequent polls
    if (showLoading && messages.length === 0) {
      setLoadingMessages(true);
    }
    try {
      const url = `${BACKEND_URL}/api/service-requests/${request._id}/messages`;
      console.log(`[Messages Debug] Fetching from: ${url}`);
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allMessages: Message[] = response.data.messages || [];
      
      // Provider-only message patterns (customer should NEVER see these)
      const providerOnlyPatterns = [
        'You\'ve received a new service request',
        'Start Code is collected ON-SITE',
        'ask the customer for the 6-digit completion code',
      ];
      
      // Filter system messages for CUSTOMER view
      const newMessages = allMessages.filter(m => {
        const isSystemMsg = m.type === 'system' || m.senderRole === 'system' || m.senderName === 'Fixr';
        
        if (isSystemMsg) {
          // If targetRole is set, respect it
          if (m.targetRole) {
            return m.targetRole === 'customer';
          }
          // For legacy messages without targetRole, check text patterns
          const msgText = m.text || '';
          const isProviderOnly = providerOnlyPatterns.some(pattern => msgText.includes(pattern));
          return !isProviderOnly; // Hide provider-only messages from customer
        }
        return true; // Non-system messages always shown
      });
      
      // DEBUG LOG: Count total and system messages
      const systemMessages = newMessages.filter(m => m.type === 'system' || m.senderRole === 'system');
      console.log(`[Messages Debug] RequestId: ${request._id}, Total: ${newMessages.length}, System: ${systemMessages.length}`);
      if (systemMessages.length > 0) {
        console.log(`[Messages Debug] First system message:`, JSON.stringify(systemMessages[0]));
      }
      
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
  const fetchMessagesQuietly = async () => {
    if (!request?._id) return;
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/service-requests/${request._id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allMessages: Message[] = response.data.messages || [];
      
      // Provider-only message patterns (customer should NEVER see these)
      const providerOnlyPatterns = [
        'You\'ve received a new service request',
        'Start Code is collected ON-SITE',
        'ask the customer for the 6-digit completion code',
      ];
      
      // Filter system messages for CUSTOMER view
      const newMessages = allMessages.filter(m => {
        const isSystemMsg = m.type === 'system' || m.senderRole === 'system' || m.senderName === 'Fixr';
        
        if (isSystemMsg) {
          // If targetRole is set, respect it
          if (m.targetRole) {
            return m.targetRole === 'customer';
          }
          // For legacy messages without targetRole, check text patterns
          const msgText = m.text || '';
          const isProviderOnly = providerOnlyPatterns.some(pattern => msgText.includes(pattern));
          return !isProviderOnly;
        }
        return true;
      });
      
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
  // Uses per-user timestamp tracking: compare last_message_at with customer_last_read_at
  const checkForUnreadMessages = useCallback(() => {
    if (!request?._id) return;
    
    // Use per-user read tracking from request object (same as inbox)
    if (request.last_message_at) {
      const lastMsgTime = new Date(request.last_message_at).getTime();
      const lastReadTime = request.customer_last_read_at 
        ? new Date(request.customer_last_read_at).getTime() 
        : 0; // Never read = treat as unread
      setHasUnreadMessages(lastMsgTime > lastReadTime);
    } else {
      setHasUnreadMessages(false);
    }
  }, [request?.last_message_at, request?.customer_last_read_at, request?._id]);

  // Re-check unread status when timestamps change
  useEffect(() => {
    if (activeTab === 'details') {
      checkForUnreadMessages();
    }
  }, [activeTab, checkForUnreadMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !request?._id) return;
    
    // Prevent sending if job is fully completed (reviewed or skipped)
    // Chat is OPEN for: in_progress, completed_pending_review
    // Chat is CLOSED for: completed_reviewed (and legacy 'completed' with review)
    const isChatClosed = request.status === 'completed_reviewed' || 
                         (request.status === 'completed' && request.customerRating !== null);
    if (isChatClosed) {
      Alert.alert('Chat Closed', 'Chat is read-only after review submission.');
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
      
      // Handle 403 - chat closed after review submission
      if (err.response?.status === 403) {
        Alert.alert('Chat Closed', 'Chat is read-only after review submission.');
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
  // CRITICAL FIX: Helper to check if job is completed (any completed state)
  const isJobCompleted = (status?: string): boolean => {
    const completedStates = ['completed', 'completed_pending_review', 'completed_reviewed'];
    return completedStates.includes(status || '');
  };

  const handlePickImage = async () => {
    if (isJobCompleted(request?.status)) {
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
    if (isJobCompleted(request?.status)) {
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
    if (isJobCompleted(request?.status)) {
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

  // Quote functions for customer
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

  const handleAcceptAndPay = async () => {
    if (!currentQuote) return;
    
    Alert.alert(
      'Confirm Payment',
      `Pay $${currentQuote.amount.toFixed(2)} ${currentQuote.currency} for "${currentQuote.title}"?\n\n(Sandbox - No real charge)`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Pay Now', 
          onPress: processPayment,
          style: 'default'
        },
      ]
    );
  };

  const processPayment = async () => {
    if (!currentQuote) return;
    
    setProcessingPayment(true);
    try {
      // Accept the quote first
      await axios.post(
        `${BACKEND_URL}/api/quotes/${currentQuote._id}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Then process sandbox payment
      const payResponse = await axios.post(
        `${BACKEND_URL}/api/quotes/${currentQuote._id}/sandbox-pay`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Handle idempotent success (already paid)
      if (isIdempotentSuccess(payResponse)) {
        Alert.alert('Info', getIdempotentMessage(payResponse));
      } else {
        // Show payment success with View Receipt option
        Alert.alert(
          'Payment Successful',
          'Your payment has been confirmed. The provider can now start the job!',
          [
            { text: 'OK', style: 'cancel' },
            { 
              text: 'View Receipt', 
              onPress: () => router.push({ pathname: '/receipt', params: { requestId: request?._id } })
            },
          ]
        );
      }
      
      setCurrentQuote(payResponse.data.quote);
      
      // Refresh request, messages, and payment status
      fetchRequestDetail();
      fetchMessagesQuietly();
      fetchPaymentStatus();
    } catch (err: any) {
      Alert.alert('Error', getUserFriendlyError(err, 'Payment failed. Please try again.'));
    } finally {
      setProcessingPayment(false);
    }
  };

  // Quote negotiation handlers
  const handleRejectQuote = async () => {
    if (!currentQuote) return;
    
    Alert.alert(
      'Reject Quote',
      `Are you sure you want to reject this quote for $${currentQuote.amount.toFixed(2)}?\n\nThe provider will be notified and can send a revised quote.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          onPress: processRejectQuote,
          style: 'destructive'
        },
      ]
    );
  };

  const processRejectQuote = async () => {
    if (!currentQuote) return;
    
    setProcessingQuoteAction(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/quotes/${currentQuote._id}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setCurrentQuote(response.data.quote);
      Alert.alert('Quote Rejected', 'The provider has been notified and can send a revised quote.');
      fetchMessagesQuietly();
    } catch (err: any) {
      Alert.alert('Error', getUserFriendlyError(err, 'Failed to reject quote.'));
    } finally {
      setProcessingQuoteAction(false);
    }
  };

  const handleCounterQuote = async () => {
    const amount = parseFloat(counterAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid counter amount greater than 0.');
      return;
    }
    
    setProcessingQuoteAction(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/quotes/${currentQuote?._id}/counter`,
        {
          counterAmount: amount,
          counterNote: counterNote.trim() || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setCurrentQuote(response.data.quote);
      setShowCounterForm(false);
      setCounterAmount('');
      setCounterNote('');
      Alert.alert('Counter Offer Sent', 'The provider has been notified of your counter offer.');
      fetchMessagesQuietly();
    } catch (err: any) {
      Alert.alert('Error', getUserFriendlyError(err, 'Failed to send counter offer.'));
    } finally {
      setProcessingQuoteAction(false);
    }
  };

  // Fetch existing review for this job
  const fetchExistingReview = async () => {
    if (!request?._id) return;
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/reviews/by-job/${request._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data) {
        setExistingReview({
          rating: response.data.rating,
          comment: response.data.comment,
        });
      }
    } catch (err: any) {
      // 404 means no review yet - that's fine
      if (err.response?.status !== 404) {
        console.log('Error fetching review:', err);
      }
    }
  };

  // Submit review
  const handleSubmitReview = async () => {
    if (!request?._id || reviewRating === 0) return;
    
    setSubmittingReview(true);
    
    try {
      const response = await api.post(
        `${BACKEND_URL}/api/reviews`,
        {
          jobId: request._id,
          rating: reviewRating,
          comment: reviewComment.trim() || undefined,
        },
        { 
          headers: { Authorization: `Bearer ${token}` },
          actionName: 'Submit Review',
        }
      );
      
      if (response.success && response.data) {
        setExistingReview({
          rating: response.data.rating,
          comment: response.data.comment,
        });
        setShowReviewForm(false);
        Alert.alert('Review Submitted', 'Thank you for your feedback!');
      } else if (response.error) {
        Alert.alert('Error', formatApiError(response.error));
      }
    } catch (err: any) {
      // Fallback for unexpected errors
      Alert.alert('Error', 'Submit Review failed. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequestDetail();
    if (activeTab === 'chat') {
      fetchMessages();
      fetchQuote();
    }
    // Refresh review status if job is completed
    if (request?.status === 'completed') {
      fetchExistingReview();
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

  // Get effective display status using shared function
  const getEffectiveStatus = () => {
    if (!request) return 'pending';
    return getEffectiveStatusShared(request);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: '#EAF3FF', text: '#4A7DC4', icon: 'time', label: 'Pending' };
      case 'accepted':
        return { bg: '#E8F5E9', text: '#2E7D32', icon: 'checkmark-circle', label: 'Accepted' };
      case 'paid':
        return { bg: '#E8F5E9', text: '#2E7D32', icon: 'card', label: 'Paid' };
      case 'awaiting_payment':
        return { bg: '#FFF3E0', text: '#E65100', icon: 'card-outline', label: 'Awaiting Payment' };
      case 'ready_to_start':
        return { bg: '#E3F2FD', text: '#1565C0', icon: 'checkmark-done', label: 'Ready to Start' };
      case 'in_progress':
        return { bg: '#E3F2FD', text: '#1565C0', icon: 'play-circle', label: 'In Progress' };
      case 'completed_pending_review':
        return { bg: '#FFF3E0', text: '#E65100', icon: 'star-half', label: 'Pending Review' };
      case 'completed_reviewed':
        return { bg: '#F3E5F5', text: '#7B1FA2', icon: 'checkmark-done-circle', label: 'Completed' };
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

  // Check if customer can cancel this request
  // Allowed: pending, accepted ONLY
  // Blocked: awaiting_payment (quote sent), in_progress, completed, etc.
  const canCancel = request && ['pending', 'accepted'].includes(request.status);

  // Check if customer can change provider (pending + provider assigned but not accepted)
  const canChangeProvider = request && 
    request.status === 'pending' && 
    request.providerId !== null && 
    request.providerId !== undefined;

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
              const errorMessage = err?.response?.data?.detail || 'We couldn\'t cancel this request. Please try again.';
              Alert.alert('Unable to Cancel', errorMessage);
            }
          },
        },
      ]
    );
  };

  const handleChangeProvider = async () => {
    if (!request?._id) return;
    
    Alert.alert(
      'Change Provider',
      'Release the current provider and select a different one?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Change',
          style: 'default',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('authToken');
              await axios.patch(
                `${BACKEND_URL}/api/service-requests/${request._id}/release-provider`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
              );
              // Navigate to provider directory to select a new provider
              router.push({
                pathname: '/(customer)/provider-directory',
                params: { 
                  requestId: request._id,
                  service: request.service,
                  fromChangeProvider: 'true'
                }
              });
            } catch (err: any) {
              const errorMessage = err?.response?.data?.detail || 'We couldn\'t change the provider. Please try again.';
              Alert.alert('Unable to Change Provider', errorMessage);
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
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchRequestDetail(); }}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusInfo = getStatusInfo(getEffectiveStatus());

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
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 140 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {(() => { console.log(`[Details Debug] requestId=${request._id} status='${request.status}'`); return null; })()}
          
          {/* DECLINED STATUS BANNER - Show when provider has declined */}
          {request.status === 'declined' && (
            <View style={styles.declinedBanner}>
              <View style={styles.declinedBannerIcon}>
                <Ionicons name="close-circle" size={28} color="#D32F2F" />
              </View>
              <Text style={styles.declinedBannerTitle}>Request Declined</Text>
              <Text style={styles.declinedBannerText}>
                This request was declined by the provider. You can submit the request again to reach other available providers.
              </Text>
            </View>
          )}

          {/* WAITING FOR QUOTE - Show when accepted but no quote sent yet */}
          {request.status === 'accepted' && (!currentQuote || !['SENT', 'ACCEPTED'].includes(currentQuote.status)) && (
            <View style={styles.waitingForQuoteCard}>
              <Ionicons name="time-outline" size={24} color="#FF9800" />
              <Text style={styles.waitingForQuoteTitle}>Waiting for Provider Quote</Text>
              <Text style={styles.waitingForQuoteSubtext}>
                The provider has accepted your request and will send a quote soon.
              </Text>
            </View>
          )}

          {/* JOB CODE CARD - ONLY show when payment is confirmed AND job has NOT started yet */}
          {/* Uses isPaid() which checks payments.status (PRIMARY) with legacy fallback */}
          {isPaid() && request.jobCode && !request.jobStartedAt && !request.startedAt && (
            <View style={styles.jobCodeCard}>
              <View style={styles.jobCodeHeader}>
                <Ionicons name="key-outline" size={20} color="#1976D2" />
                <Text style={styles.jobCodeLabel}>START JOB CODE</Text>
              </View>
              <Text style={styles.jobCodeValue}>
                {request.jobCode.slice(0, 3)}{' '}{request.jobCode.slice(3)}
              </Text>
              <Text style={styles.jobCodeHint}>
                ✓ Payment confirmed! Share this code when provider arrives to start the job.
              </Text>
            </View>
          )}

          {/* COMPLETION OTP CARD - Show when job is in progress */}
          {request.status === 'in_progress' && request.completionOtp && (
            <View style={styles.completionOtpCard}>
              <View style={styles.completionOtpHeader}>
                <Ionicons name="key" size={22} color="#4CAF50" />
                <Text style={styles.completionOtpTitle}>Completion OTP</Text>
              </View>
              <Text style={styles.completionOtpValue}>
                {request.completionOtp.slice(0, 3)}{' '}{request.completionOtp.slice(3)}
              </Text>
              <Text style={styles.completionOtpHint}>Share this code with the provider when the job is completed</Text>
            </View>
          )}

          {/* In Progress Status - Light blue theme */}
          {request.status === 'in_progress' && (
            <View style={styles.inProgressCard}>
              <Ionicons name="play-circle" size={22} color="#4A90D9" />
              <View style={styles.inProgressContent}>
                <Text style={styles.inProgressTitle}>Job In Progress</Text>
                <Text style={styles.inProgressText}>The provider is working on your request</Text>
              </View>
            </View>
          )}

          {/* JOB STARTED CONFIRMATION - Shows after job code verified */}
          {['in_progress', 'completed', 'completed_pending_review', 'completed_reviewed'].includes(request.status) && (request.jobStartedAt || request.startedAt) && (
            <View style={styles.customerJobStartedCard}>
              <View style={styles.customerJobStartedHeader}>
                <Ionicons name="play-circle" size={26} color="#2196F3" />
                <Text style={styles.customerJobStartedTitle}>Job Started</Text>
              </View>
              <View style={styles.customerJobStartedDetails}>
                {request.jobCode && (
                  <View style={styles.customerJobDetailRow}>
                    <Text style={styles.customerJobDetailLabel}>Start Code</Text>
                    <Text style={styles.customerJobDetailValue}>{request.jobCode}</Text>
                  </View>
                )}
                <View style={styles.customerJobDetailRow}>
                  <Text style={styles.customerJobDetailLabel}>Started At</Text>
                  <Text style={styles.customerJobDetailValue}>{formatDateTime(request.jobStartedAt || request.startedAt)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* JOB COMPLETED CONFIRMATION - Shows after job is completed (any completed state) */}
          {['completed', 'completed_pending_review', 'completed_reviewed'].includes(request.status) && (
            <View style={styles.customerJobCompletedCard}>
              <View style={styles.customerJobCompletedHeader}>
                <Ionicons name="checkmark-done-circle" size={26} color="#4CAF50" />
                <Text style={styles.customerJobCompletedTitle}>Job Completed</Text>
              </View>
              <View style={styles.customerJobCompletedDetails}>
                {request.completionOtp && (
                  <View style={styles.customerJobDetailRow}>
                    <Text style={styles.customerJobDetailLabel}>Completion Code</Text>
                    <Text style={styles.customerJobDetailValue}>{request.completionOtp}</Text>
                  </View>
                )}
                {(request.jobCompletedAt || request.completedAt) && (
                  <View style={styles.customerJobDetailRow}>
                    <Text style={styles.customerJobDetailLabel}>Completed At</Text>
                    <Text style={styles.customerJobDetailValue}>{formatDateTime(request.jobCompletedAt || request.completedAt)}</Text>
                  </View>
                )}
              </View>
              {request.status === 'completed_pending_review' && !request.customerRating && (
                <Text style={styles.customerJobCompletedNote}>
                  This job has been successfully completed. Please leave a review for your provider.
                </Text>
              )}
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

          {/* Change Provider Button - Only shown for pending requests with assigned provider */}
          {canChangeProvider && (
            <TouchableOpacity style={styles.changeProviderButton} onPress={handleChangeProvider}>
              <Ionicons name="swap-horizontal-outline" size={20} color="#1976D2" />
              <Text style={styles.changeProviderButtonText}>Change Provider</Text>
            </TouchableOpacity>
          )}

          {/* Cancel Button - Only shown for pending or accepted requests */}
          {canCancel && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelRequest}>
              <Ionicons name="close-circle-outline" size={20} color="#E53935" />
              <Text style={styles.cancelButtonText}>Cancel Request</Text>
            </TouchableOpacity>
          )}

          {/* REVIEW SECTION - Show for completed jobs (all completed states) */}
          {['completed', 'completed_pending_review', 'completed_reviewed'].includes(request.status) && (
            <View style={styles.reviewSection}>
              {existingReview || request.customerRating !== null ? (
                // Show submitted review
                <View style={styles.reviewSubmittedCard}>
                  <View style={styles.reviewSubmittedHeader}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.reviewSubmittedTitle}>Review Submitted</Text>
                  </View>
                  <View style={styles.reviewStarsDisplay}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= (existingReview?.rating || request.customerRating || 0) ? 'star' : 'star-outline'}
                        size={24}
                        color="#FFB300"
                      />
                    ))}
                  </View>
                  {(existingReview?.comment || request.customerReview) && (
                    <Text style={styles.reviewCommentText}>"{existingReview?.comment || request.customerReview}"</Text>
                  )}
                </View>
              ) : (
                // Show "Leave a Review" button - Navigate to dedicated review screen
                <TouchableOpacity
                  style={styles.leaveReviewButton}
                  onPress={() => router.push({ pathname: '/leave-review', params: { requestId: request._id } })}
                >
                  <Ionicons name="star-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.leaveReviewButtonText}>Leave a Review</Text>
                </TouchableOpacity>
              )}
            </View>
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
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={[
                styles.messagesContent,
                messages.length === 0 && styles.messagesContentEmpty
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 ? (
                <View style={styles.emptyChatInner}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#CCC" />
                  <Text style={styles.emptyChatTitle}>No messages yet</Text>
                  <Text style={styles.emptyChatText}>Keep all job communication in one place</Text>
                </View>
              ) : (
                <>
                  {/* Payment confirmation and status banners - scroll with messages */}
                  {/* Uses isPaid() which checks payments.status (PRIMARY) with legacy fallback */}
                  {currentQuote && currentQuote.status === 'ACCEPTED' && isPaid() && (
                    <View style={[styles.quoteCard, styles.quoteCardPaid, styles.scrollableQuoteCard]}>
                      <View style={styles.quoteCardHeader}>
                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                        <Text style={styles.quoteCardTitle}>Payment Confirmed</Text>
                      </View>
                      <Text style={styles.quoteCardServiceTitle}>{currentQuote.title}</Text>
                      <Text style={styles.quoteCardAmountPaid}>${currentQuote.amount.toFixed(2)} {currentQuote.currency}</Text>
                      <TouchableOpacity 
                        style={styles.viewReceiptButton}
                        onPress={() => router.push({ pathname: '/receipt', params: { requestId: request._id } })}
                      >
                        <Ionicons name="receipt-outline" size={16} color="#2ecc71" />
                        <Text style={styles.viewReceiptText}>View Receipt</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {request.status === 'awaiting_payment' && isPaid() && (
                    <View style={[styles.statusBannerPaidScrollable]}>
                      <Ionicons name="time-outline" size={16} color="#2E7D32" />
                      <Text style={styles.statusBannerPaidText}>Payment secured! Waiting for provider to start.</Text>
                    </View>
                  )}
                  {request.status === 'in_progress' && (
                    <View style={[styles.statusBannerInProgressScrollable]}>
                      <Ionicons name="construct" size={16} color="#1565C0" />
                      <Text style={styles.statusBannerInProgressText}>Job in progress</Text>
                    </View>
                  )}
                  
                  {messages.map((msg) => {
                    const isMine = msg.senderId === user?._id;
                    const isSystem = msg.type === 'system' || (msg.senderRole as string) === 'system';
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
                            style={styles.imageContainer} 
                            onPress={() => setFullScreenImage(imageUri)}
                            activeOpacity={0.9}
                          >
                            <Image
                              source={{ uri: imageUri }}
                              style={styles.chatImage}
                              resizeMode="cover"
                            />
                            <View style={styles.imageOverlay}>
                              <Ionicons name="expand-outline" size={20} color="rgba(255,255,255,0.8)" />
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
                </>
              )}
            </ScrollView>
          )}

          {/* Message Input or Read-Only Banner */}
          {/* CRITICAL FIX: Chat CLOSED for ALL completed states */}
          {(() => {
            const isChatClosed = isJobCompleted(request.status);
            return isChatClosed ? (
              <View style={[styles.chatClosedBanner, { paddingBottom: insets.bottom + 12 }]}>
                <Ionicons name="lock-closed" size={16} color="#666" />
                <Text style={styles.chatClosedText}>Chat closed — job completed.</Text>
              </View>
            ) : (
            <View style={{ paddingBottom: insets.bottom + 12 }}>
              {/* Quote Card - Show when there's a quote pending (SENT status) */}
              {currentQuote && currentQuote.status === 'SENT' && (
                <View style={styles.quoteCard}>
                  <View style={styles.quoteCardHeader}>
                    <Ionicons name="document-text" size={20} color="#4CAF50" />
                    <Text style={styles.quoteCardTitle}>Quote from Provider</Text>
                    <View style={styles.quoteStatusBadge}>
                      <Text style={styles.quoteStatusText}>
                        {currentQuote.revision && currentQuote.revision > 1 ? `REVISED #${currentQuote.revision}` : 'PENDING'}
                      </Text>
                    </View>
                  </View>
                  {/* Provider Rating Display */}
                  {(currentQuote.providerRating !== undefined && currentQuote.providerRating > 0) && (
                    <View style={styles.quoteProviderRating}>
                      <Ionicons name="star" size={16} color="#FFB300" />
                      <Text style={styles.quoteProviderRatingText}>
                        {currentQuote.providerRating.toFixed(1)} ({currentQuote.providerReviewCount || 0} reviews)
                      </Text>
                    </View>
                  )}
                  <Text style={styles.quoteCardServiceTitle}>{currentQuote.title}</Text>
                  {currentQuote.description ? (
                    <Text style={styles.quoteCardDescription}>{currentQuote.description}</Text>
                  ) : null}
                  {currentQuote.note ? (
                    <Text style={styles.quoteCardNote}>Note: {currentQuote.note}</Text>
                  ) : null}
                  <Text style={styles.quoteCardAmount}>${currentQuote.amount.toFixed(2)} {currentQuote.currency}</Text>
                  
                  {/* Counter Form */}
                  {showCounterForm ? (
                    <View style={styles.counterFormContainer}>
                      <Text style={styles.counterFormTitle}>Make a Counter Offer</Text>
                      <View style={styles.counterInputRow}>
                        <Text style={styles.counterCurrencyLabel}>$</Text>
                        <TextInput
                          style={styles.counterAmountInput}
                          placeholder="Your offer"
                          placeholderTextColor="#999"
                          keyboardType="decimal-pad"
                          value={counterAmount}
                          onChangeText={setCounterAmount}
                        />
                      </View>
                      <TextInput
                        style={styles.counterNoteInput}
                        placeholder="Add a note (optional)"
                        placeholderTextColor="#999"
                        value={counterNote}
                        onChangeText={setCounterNote}
                        maxLength={500}
                        multiline
                      />
                      <View style={styles.counterFormButtons}>
                        <TouchableOpacity
                          style={styles.counterCancelButton}
                          onPress={() => {
                            setShowCounterForm(false);
                            setCounterAmount('');
                            setCounterNote('');
                          }}
                        >
                          <Text style={styles.counterCancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.counterSubmitButton, processingQuoteAction && styles.buttonDisabled]}
                          onPress={handleCounterQuote}
                          disabled={processingQuoteAction}
                        >
                          {processingQuoteAction ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.counterSubmitButtonText}>Send Counter</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      {/* Accept & Pay Button */}
                      <TouchableOpacity
                        style={styles.acceptPayButton}
                        onPress={handleAcceptAndPay}
                        disabled={processingPayment || processingQuoteAction}
                      >
                        {processingPayment ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="card" size={18} color="#FFFFFF" />
                            <Text style={styles.acceptPayButtonText}>Accept & Pay (Sandbox)</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      
                      {/* Reject / Counter Row */}
                      <View style={styles.quoteSecondaryActions}>
                        <TouchableOpacity
                          style={styles.rejectQuoteButton}
                          onPress={handleRejectQuote}
                          disabled={processingQuoteAction}
                        >
                          <Ionicons name="close-circle-outline" size={18} color="#E53935" />
                          <Text style={styles.rejectQuoteButtonText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.counterQuoteButton}
                          onPress={() => setShowCounterForm(true)}
                          disabled={processingQuoteAction}
                        >
                          <Ionicons name="swap-horizontal" size={18} color="#1976D2" />
                          <Text style={styles.counterQuoteButtonText}>Counter Offer</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* Quote Card - REJECTED status (waiting for provider revision) */}
              {currentQuote && currentQuote.status === 'REJECTED' && (
                <View style={[styles.quoteCard, styles.quoteCardRejected]}>
                  <View style={styles.quoteCardHeader}>
                    <Ionicons name="close-circle" size={20} color="#E53935" />
                    <Text style={styles.quoteCardTitle}>Quote Rejected</Text>
                  </View>
                  <Text style={styles.quoteCardServiceTitle}>{currentQuote.title}</Text>
                  <Text style={styles.quoteCardAmountStrikethrough}>${currentQuote.amount.toFixed(2)} {currentQuote.currency}</Text>
                  <Text style={styles.quoteWaitingText}>Waiting for provider to send a revised quote...</Text>
                </View>
              )}

              {/* Quote Card - COUNTERED status (waiting for provider revision) */}
              {currentQuote && currentQuote.status === 'COUNTERED' && (
                <View style={[styles.quoteCard, styles.quoteCardCountered]}>
                  <View style={styles.quoteCardHeader}>
                    <Ionicons name="swap-horizontal" size={20} color="#FF9800" />
                    <Text style={styles.quoteCardTitle}>Counter Offer Sent</Text>
                  </View>
                  <Text style={styles.quoteCardServiceTitle}>{currentQuote.title}</Text>
                  <View style={styles.counterOfferSummary}>
                    <View style={styles.counterOfferRow}>
                      <Text style={styles.counterOfferLabel}>Original:</Text>
                      <Text style={styles.counterOfferOriginal}>${currentQuote.amount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.counterOfferRow}>
                      <Text style={styles.counterOfferLabel}>Your offer:</Text>
                      <Text style={styles.counterOfferYours}>${currentQuote.counterAmount?.toFixed(2)}</Text>
                    </View>
                    {currentQuote.counterNote && (
                      <Text style={styles.counterOfferNote}>"{currentQuote.counterNote}"</Text>
                    )}
                  </View>
                  <Text style={styles.quoteWaitingText}>Waiting for provider to respond...</Text>
                </View>
              )}

              {/* Quote Card - ACCEPTED status (payment required) */}
              {/* Uses isPaid() which checks payments.status (PRIMARY) with legacy fallback */}
              {currentQuote && currentQuote.status === 'ACCEPTED' && !isPaid() && (
                <View style={[styles.quoteCard, styles.quoteCardAccepted]}>
                  <View style={styles.quoteCardHeader}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.quoteCardTitle}>Quote Accepted</Text>
                  </View>
                  <Text style={styles.quoteCardServiceTitle}>{currentQuote.title}</Text>
                  <Text style={styles.quoteCardAmount}>${currentQuote.amount.toFixed(2)} {currentQuote.currency}</Text>
                  <Text style={styles.testModeNotice}>Payments are in testing mode</Text>
                  <TouchableOpacity
                    style={styles.acceptPayButton}
                    onPress={processPayment}
                    disabled={processingPayment}
                  >
                    {processingPayment ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="card" size={18} color="#FFFFFF" />
                        <Text style={styles.acceptPayButtonText}>Complete Payment (Sandbox)</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              {/* NOTE: Paid quote card and status banners moved INSIDE ScrollView above */}
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
          );
          })()}
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
  // DECLINED BANNER - Red theme
  declinedBanner: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    alignItems: 'center',
  },
  declinedBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFCDD2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  declinedBannerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#D32F2F',
    marginBottom: 8,
  },
  declinedBannerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  // WAITING FOR QUOTE CARD - Orange theme
  waitingForQuoteCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFE082',
    alignItems: 'center',
  },
  waitingForQuoteTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF9800',
    marginTop: 8,
    marginBottom: 4,
  },
  waitingForQuoteSubtext: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  // JOB CODE CARD - Compact, subtle light blue
  jobCodeCard: {
    backgroundColor: '#EEF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C5DFFF',
    alignItems: 'center',
  },
  jobCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  jobCodeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1976D2',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  jobCodeValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1565C0',
    letterSpacing: 6,
    marginBottom: 8,
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
    fontSize: 13,
    color: '#1976D2',
    textAlign: 'center',
    lineHeight: 18,
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
  // Customer Job Started Confirmation Card
  customerJobStartedCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  customerJobStartedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  customerJobStartedTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1565C0',
  },
  customerJobStartedDetails: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  customerJobDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E3F2FD',
  },
  customerJobDetailLabel: {
    fontSize: 14,
    color: '#666',
  },
  customerJobDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
  },
  // Customer Job Completed Confirmation Card
  customerJobCompletedCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  customerJobCompletedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  customerJobCompletedTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2E7D32',
  },
  customerJobCompletedDetails: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  customerJobCompletedNote: {
    fontSize: 13,
    color: '#388E3C',
    textAlign: 'center',
    fontStyle: 'italic',
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
  emptyChatInner: {
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
  messagesContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginVertical: 6,
    paddingHorizontal: 24,
  },
  systemMessageBubble: {
    backgroundColor: '#F0F4F8',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E0E7EF',
  },
  systemMessageText: {
    fontSize: 12,
    color: '#6B7A8D',
    textAlign: 'center',
    fontWeight: '400',
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
  changeProviderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
    gap: 8,
  },
  changeProviderButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1976D2',
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
  imageContainer: {
    width: 200,
    height: 180,
    maxHeight: 220,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
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
  // Quote card styles for customer
  quoteCard: {
    backgroundColor: '#F8FFF8',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  quoteCardPaid: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
  },
  quoteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  quoteCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#388E3C',
    flex: 1,
  },
  quoteStatusBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  quoteStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F57C00',
  },
  quoteCardServiceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  quoteCardDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  quoteProviderRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  quoteProviderRatingText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  quoteCardAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 8,
  },
  quoteCardAmountPaid: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2E7D32',
  },
  viewReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 7,
    backgroundColor: '#f0f9f4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2ecc71',
    gap: 4,
  },
  viewReceiptText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2ecc71',
  },
  acceptPayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 11,
    borderRadius: 8,
    gap: 6,
  },
  acceptPayButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  testModeNotice: {
    fontSize: 12,
    color: '#FF9800',
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  // Quote negotiation styles
  quoteCardNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  quoteSecondaryActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  rejectQuoteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E53935',
    gap: 4,
  },
  rejectQuoteButtonText: {
    color: '#E53935',
    fontSize: 13,
    fontWeight: '600',
  },
  counterQuoteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1976D2',
    gap: 4,
  },
  counterQuoteButtonText: {
    color: '#1976D2',
    fontSize: 13,
    fontWeight: '600',
  },
  counterFormContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  counterFormTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  counterInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  counterCurrencyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginRight: 6,
  },
  counterAmountInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  counterNoteInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1A1A',
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  counterFormButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  counterCancelButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#999',
    alignItems: 'center',
  },
  counterCancelButtonText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  counterSubmitButton: {
    flex: 2,
    backgroundColor: '#1976D2',
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: 'center',
  },
  counterSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Quote status variant styles
  quoteCardRejected: {
    borderColor: '#FFCDD2',
    backgroundColor: '#FFF5F5',
  },
  quoteCardCountered: {
    borderColor: '#FFE0B2',
    backgroundColor: '#FFF8E1',
  },
  quoteCardAccepted: {
    borderColor: '#C8E6C9',
    backgroundColor: '#F1F8E9',
  },
  quoteCardAmountStrikethrough: {
    fontSize: 20,
    fontWeight: '600',
    color: '#999',
    textDecorationLine: 'line-through',
    marginBottom: 8,
  },
  quoteWaitingText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  counterOfferSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 8,
    marginVertical: 4,
  },
  counterOfferRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  counterOfferLabel: {
    fontSize: 12,
    color: '#666',
  },
  counterOfferOriginal: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  counterOfferYours: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  counterOfferNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Scrollable status banners (inside ScrollView)
  scrollableQuoteCard: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  statusBannerPaidScrollable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 6,
    gap: 6,
  },
  statusBannerPaidText: {
    fontSize: 12,
    color: '#2E7D32',
    flex: 1,
  },
  statusBannerInProgressScrollable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 6,
    gap: 6,
  },
  statusBannerInProgressText: {
    fontSize: 12,
    color: '#1565C0',
    flex: 1,
  },
  // Review Section Styles
  reviewSection: {
    marginTop: 16,
    marginBottom: 24,
  },
  leaveReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  leaveReviewButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  reviewFormCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  reviewFormTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  starButton: {
    padding: 4,
  },
  reviewCommentInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
    color: '#1A1A1A',
  },
  reviewFormButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  reviewCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#999',
    alignItems: 'center',
  },
  reviewCancelButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  reviewSubmitButton: {
    flex: 2,
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewSubmitButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  reviewSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  reviewSubmittedCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A5D6A7',
    alignItems: 'center',
  },
  reviewSubmittedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reviewSubmittedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  reviewStarsDisplay: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  reviewCommentText: {
    fontSize: 14,
    color: '#558B2F',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
});
