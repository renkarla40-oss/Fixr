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
import { useAuth } from '../../contexts/AuthContext';
import { getServiceLabel } from '../../constants/serviceCategories';
import { getUserFriendlyError, isIdempotentSuccess, getIdempotentMessage } from '../../utils/errorMessages';
import { getEffectiveStatus as getEffectiveStatusShared } from '../../constants/statusStyles';

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
  startedAt?: string;
  jobCompletedAt?: string;
  completedAt?: string;
  completionOtp?: string;
  // Per-user unread tracking fields
  last_message_at?: string;
  provider_last_read_at?: string;
  // Customer review fields
  customerRating?: number;
  customerReview?: string;
  reviewedAt?: string;
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
}

type TabType = 'details' | 'chat';

export default function ProviderRequestDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, user, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const requestId = params.requestId as string;
  const openChat = params.openChat === 'true';
  
  // INSTANT NAVIGATION: Get cached data for this specific request
  const cacheKey = CACHE_KEYS.PROVIDER_JOB_DETAIL(requestId || '');
  const cachedData = requestId ? getCachedData<ServiceRequest>(cacheKey) : null;

  const [request, setRequest] = useState<ServiceRequest | null>(cachedData);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(!cachedData); // Only show loading if no cache
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
  
  // Performance timing
  const timingRef = useRef(createTimingTracker('Provider Job Details'));

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
  
  // Cancel job state
  const [cancellingJob, setCancellingJob] = useState(false);

  // Payout info (read-only display)
  const [payoutInfo, setPayoutInfo] = useState<{
    exists: boolean;
    amount?: number;
    currency?: string;
    status?: string;
    releasedAt?: string;
    message?: string;
  } | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const unreadPollingRef = useRef<NodeJS.Timeout | null>(null);
  const prevMessageCountRef = useRef<number>(0); // Track previous message count for scroll logic
  const fetchCounterRef = useRef<number>(0); // STABILITY: Stale response protection
  const hasEverLoadedRef = useRef<boolean>(false); // STABILITY: Track if we've ever loaded data
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
      setJobCodeInput('');
      setCompletionOtpInput('');
      setShowCompletionOtpInput(false);
      setPayoutInfo(null);
      setActiveTab(openChat ? 'chat' : 'details');
      setHasUnreadMessages(false);
      hasEverLoadedRef.current = false;
      fetchCounterRef.current = 0;
      prevMessageCountRef.current = 0;
    }
  }, [requestId, openChat]);

  // Fetch request detail on mount and screen focus WITH COOLDOWN
  useFocusEffect(
    useCallback(() => {
      // Log first render timing
      timingRef.current.logFirstRender();
      
      if (!token) {
        // Token not yet available - auth may still be loading
        // Don't set error here, just wait
        return;
      }
      
      // Check cooldown before refetching
      if (requestId && shouldRefetch(cacheKey)) {
        fetchRequestDetail();
      } else if (cachedData) {
        // Use cached data, skip fetch
        setLoading(false);
      } else if (!requestId) {
        setError('No request ID provided');
        setLoading(false);
      }
      
      // Cleanup on unfocus - cancel pending requests
      return () => {
        cancelRequest(cacheKey);
      };
    }, [requestId, token])
  );

  // Refetch messages when screen gains focus (if on chat tab)
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'chat' && request?._id) {
        fetchMessages();
      }
    }, [activeTab, request?._id])
  );

  // STABILITY: Removed aggressive continuous polling - now only refreshes on focus
  // Status updates will come from useFocusEffect and pull-to-refresh
  
  // Tab-based logic with FOCUS-SCOPED POLLING for real-time updates
  useEffect(() => {
    if (activeTab === 'chat' && request) {
      // Set loading immediately to prevent "No messages" flash
      setLoadingMessages(true);
      // Clear red dot immediately when opening chat
      setHasUnreadMessages(false);
      fetchMessages();
      fetchQuote(); // Fetch latest quote for this request
      
      // Mark messages as read on server, then refresh request to get updated provider_last_read_at
      markMessagesAsRead().then(() => {
        fetchMessagesQuietly();
        // CRITICAL: Refresh request to get updated provider_last_read_at so red dot stays cleared
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

  // Fetch payout info when job is in a completed state
  useEffect(() => {
    if (request?._id) {
      const completedStates = ['completed_pending_review', 'completed_reviewed', 'completed'];
      if (completedStates.includes(request.status)) {
        fetchPayoutInfo();
      }
    }
  }, [request?._id, request?.status]);

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
    // STABILITY: Guard against empty/invalid requestId
    if (!requestId || !token) {
      if (!hasEverLoadedRef.current) {
        setError('No request ID provided');
        setLoading(false);
      }
      return;
    }
    
    // SINGLE-FLIGHT: Skip if already fetching
    if (isRequestInFlight(cacheKey)) {
      console.log('[FETCH] Provider Job Details skip (already in-flight)');
      return;
    }
    
    // BACKOFF: Skip if in backoff period
    if (isInBackoff(cacheKey)) {
      console.log('[FETCH] Provider Job Details skip (in backoff)');
      return;
    }
    
    // STABILITY: Stale response protection
    const thisFetch = ++fetchCounterRef.current;
    
    console.log('[NAV] Provider Job Details focused');
    console.log('[FETCH] Provider Job Details start');
    
    // Mark fetch started
    setRequestInFlight(cacheKey, true);
    markFetchStarted(cacheKey);
    
    try {
      const response = await api.get(`${BACKEND_URL}/api/service-requests/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` },
        actionName: 'Load Job Details',
      });
      
      // Only update state if this is still the latest fetch
      if (thisFetch !== fetchCounterRef.current) return;
      
      if (response.success && response.data) {
        hasEverLoadedRef.current = true;
        setRequest(response.data);
        setCachedData(cacheKey, response.data);
        clearBackoff(cacheKey);
        setError(null);
        console.log('[FETCH] Provider Job Details success');
        timingRef.current.logDataLoaded();
      } else if (response.error) {
        if (response.error.statusCode === 429) {
          setBackoff(cacheKey, 1);
        }
        // Only show error if no existing data
        if (!hasEverLoadedRef.current) {
          setError(formatApiError(response.error));
        }
        console.log(`[FETCH] Provider Job Details failed ${response.error.statusCode || 'unknown'}`);
      }
    } catch (err: any) {
      // Only update state if this is still the latest fetch
      if (thisFetch !== fetchCounterRef.current) return;
      
      console.log('[FETCH] Provider Job Details failed (exception)');
      if (!hasEverLoadedRef.current) {
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
      const allMessages: Message[] = response.data.messages || [];
      
      // Customer-only message patterns (provider should NEVER see these)
      const customerOnlyPatterns = [
        'Your request was sent',
        'Job Start Code is ready',
        'Completion OTP is ready',
        'Provider accepted your request',
      ];
      
      // Filter system messages for PROVIDER view
      const newMessages = allMessages.filter(m => {
        const isSystemMsg = m.type === 'system' || m.senderRole === 'system' || m.senderName === 'Fixr';
        
        if (isSystemMsg) {
          // If targetRole is set, respect it
          if (m.targetRole) {
            return m.targetRole === 'provider';
          }
          // For legacy messages without targetRole, check text patterns
          const msgText = m.text || '';
          const isCustomerOnly = customerOnlyPatterns.some(pattern => msgText.includes(pattern));
          return !isCustomerOnly; // Hide customer-only messages from provider
        }
        return true; // Non-system messages always shown
      });
      
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
      const allMessages: Message[] = response.data.messages || [];
      
      // Customer-only message patterns (provider should NEVER see these)
      const customerOnlyPatterns = [
        'Your request was sent',
        'Job Start Code is ready',
        'Completion OTP is ready',
        'Provider accepted your request',
      ];
      
      // Filter system messages for PROVIDER view
      const newMessages = allMessages.filter(m => {
        const isSystemMsg = m.type === 'system' || m.senderRole === 'system' || m.senderName === 'Fixr';
        
        if (isSystemMsg) {
          // If targetRole is set, respect it
          if (m.targetRole) {
            return m.targetRole === 'provider';
          }
          // For legacy messages without targetRole, check text patterns
          const msgText = m.text || '';
          const isCustomerOnly = customerOnlyPatterns.some(pattern => msgText.includes(pattern));
          return !isCustomerOnly; // Hide customer-only messages from provider
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

  // Fetch payout info for completed jobs (read-only display)
  const fetchPayoutInfo = async () => {
    if (!request?._id) return;
    
    // Only fetch for completed jobs
    const completedStates = ['completed_pending_review', 'completed_reviewed', 'completed'];
    if (!completedStates.includes(request.status)) return;
    
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/payouts/by-request/${request._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPayoutInfo(response.data);
    } catch (err: any) {
      // Silent fail - payout may not exist yet
      if (err.response?.status === 404) {
        setPayoutInfo({ exists: false, message: 'Payout information will appear here once available.' });
      }
      // Don't set error state for other errors, just leave payoutInfo as null
    }
  };

  // Check for unread messages while on Details tab
  // Uses per-user timestamp tracking: compare last_message_at with provider_last_read_at
  const checkForUnreadMessages = useCallback(() => {
    if (!request?._id) return;
    
    // Use per-user read tracking from request object (same as inbox)
    if (request.last_message_at) {
      const lastMsgTime = new Date(request.last_message_at).getTime();
      const lastReadTime = request.provider_last_read_at 
        ? new Date(request.provider_last_read_at).getTime() 
        : 0; // Never read = treat as unread
      setHasUnreadMessages(lastMsgTime > lastReadTime);
    } else {
      setHasUnreadMessages(false);
    }
  }, [request?.last_message_at, request?.provider_last_read_at, request?._id]);

  // Re-check unread status when timestamps change
  useEffect(() => {
    if (activeTab === 'details') {
      checkForUnreadMessages();
    }
  }, [activeTab, checkForUnreadMessages]);

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
    // CRITICAL FIX: Block image upload for ALL completed states
    const completedStates = ['completed', 'completed_pending_review', 'completed_reviewed'];
    if (completedStates.includes(request?.status || '')) {
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
      const createResponse = await api.post(
        `${BACKEND_URL}/api/quotes`,
        {
          requestId: request._id,
          title: quoteTitle.trim(),
          description: quoteDescription.trim(),
          amount: amount,
          note: quoteNote.trim() || undefined,
          currency: 'TTD',
        },
        { 
          headers: { Authorization: `Bearer ${token}` },
          actionName: 'Create Quote',
        }
      );
      
      if (!createResponse.success || !createResponse.data?.quote?._id) {
        if (createResponse.error) {
          Alert.alert('Error', formatApiError(createResponse.error));
        } else {
          Alert.alert('Error', 'Send Quote failed. Please try again.');
        }
        return;
      }
      
      const quoteId = createResponse.data.quote._id;
      
      // Send the quote
      const sendResponse = await api.post(
        `${BACKEND_URL}/api/quotes/${quoteId}/send`,
        {},
        { 
          headers: { Authorization: `Bearer ${token}` },
          actionName: 'Send Quote',
        }
      );
      
      if (sendResponse.success && sendResponse.data?.quote) {
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
      } else if (sendResponse.error) {
        Alert.alert('Error', formatApiError(sendResponse.error));
      }
    } catch (err: any) {
      // Fallback for unexpected errors
      Alert.alert('Error', 'Send Quote failed. Please try again.');
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

  // Provider cancels job (after accepting, before starting)
  const handleCancelJob = () => {
    Alert.alert(
      'Cancel this job?',
      'This will notify the customer and close this job.',
      [
        { text: 'No, keep job', style: 'cancel' },
        { 
          text: 'Yes, cancel job', 
          style: 'destructive', 
          onPress: async () => {
            setCancellingJob(true);
            try {
              await axios.patch(
                `${BACKEND_URL}/api/service-requests/${requestId}/cancel`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
              );
              await fetchRequestDetail();
              Alert.alert('Job Cancelled', 'The customer has been notified.');
            } catch (err: any) {
              const message = err?.response?.data?.detail || 'Failed to cancel job. Please try again.';
              Alert.alert('Error', message);
            } finally {
              setCancellingJob(false);
            }
          }
        },
      ]
    );
  };

  const updateRequestStatus = async (action: 'accept' | 'decline') => {
    setActionLoading(true);
    const actionName = action === 'accept' ? 'Accept Job' : 'Decline Job';
    
    try {
      const response = await api.patch(
        `${BACKEND_URL}/api/service-requests/${requestId}/${action}`,
        {},
        { 
          headers: { Authorization: `Bearer ${token}` },
          actionName: actionName,
        }
      );
      
      if (response.success) {
        // Immediately re-fetch to update local state with latest from DB
        await fetchRequestDetail();
        Alert.alert(
          'Success',
          `Request ${action === 'accept' ? 'accepted' : 'declined'} successfully!`
        );
      } else if (response.error) {
        Alert.alert('Error', formatApiError(response.error));
      }
    } catch (err: any) {
      // Fallback for unexpected errors
      Alert.alert('Error', `${actionName} failed. Please try again.`);
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
        // Auto-navigate to payout status screen on successful completion
        setShowCompletionOtpInput(false);
        setCompletionOtpInput('');
        router.push({ pathname: '/provider-payout-status', params: { requestId: request._id } });
        return; // Exit early - payout screen will handle the success flow
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
      // CRITICAL FIX: All completed states show "Completed" as primary status
      case 'completed_pending_review':
        return { bg: '#F3E5F5', text: '#7B1FA2', icon: 'checkmark-done-circle', label: 'Completed' };
      case 'completed_reviewed':
        return { bg: '#F3E5F5', text: '#7B1FA2', icon: 'checkmark-done-circle', label: 'Completed' };
      case 'completed':
        return { bg: '#F3E5F5', text: '#7B1FA2', icon: 'checkmark-done-circle', label: 'Completed' };
      case 'declined':
        return { bg: '#FFEBEE', text: '#C62828', icon: 'close-circle', label: 'Declined' };
      case 'cancelled':
        return { bg: '#FFF3E0', text: '#E65100', icon: 'close-circle-outline', label: 'Cancelled' };
      default:
        return { bg: '#EAF3FF', text: '#4A7DC4', icon: 'time', label: status };
    }
  };

  // Loading state - includes auth loading and request loading
  if (loading || authLoading) {
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
          <Text style={styles.loadingText}>{authLoading ? 'Authenticating...' : 'Loading request...'}</Text>
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
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchRequestDetail(); }}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusInfo = getStatusInfo(getEffectiveStatus());
  // Only show Accept/Decline buttons for truly pending jobs (not any other state)
  const canAcceptOrDecline = request.status === 'pending';

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
              { paddingBottom: canAcceptOrDecline ? insets.bottom + 88 : bottomTabBarHeight + 16 }
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

            {/* Job Code Entry - ONLY show when payment is confirmed (held) */}
            {request.paymentStatus === 'held' && request.status === 'awaiting_payment' && (
              <View style={styles.jobCodeSection}>
                <Text style={styles.jobCodeLabel}>✓ Payment Confirmed! Start Job</Text>
                <Text style={styles.jobCodeHint}>Payment secured. Start Code is collected ON-SITE. When you arrive at the job location, ask the customer to reveal the 6-digit Start Code to officially begin the job.</Text>
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

            {/* Send Quote CTA - Show on Details tab when accepted but no quote/payment yet */}
            {request.status === 'accepted' && (!currentQuote || currentQuote.status === 'VOID') && (
              <View style={styles.sendQuoteCTASection}>
                <View style={styles.sendQuoteCTAHeader}>
                  <Ionicons name="document-text-outline" size={24} color="#E53935" />
                  <Text style={styles.sendQuoteCTATitle}>Send Quote to Customer</Text>
                </View>
                <Text style={styles.sendQuoteCTASubtext}>
                  The customer is waiting for your quote. Send your price to proceed.
                </Text>
                <TouchableOpacity
                  style={styles.sendQuoteCTAButton}
                  onPress={() => setShowQuoteModal(true)}
                >
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                  <Text style={styles.sendQuoteCTAButtonText}>Send Quote</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Quote Pending Status - Show when quote sent but awaiting response */}
            {currentQuote && currentQuote.status === 'SENT' && (
              <View style={styles.quoteStatusSection}>
                <View style={styles.quoteStatusHeader}>
                  <Ionicons name="time-outline" size={20} color="#FF9800" />
                  <Text style={styles.quoteStatusTitle}>Quote Sent</Text>
                </View>
                <Text style={styles.quoteStatusAmount}>${currentQuote.amount.toFixed(2)}</Text>
                <Text style={styles.quoteStatusSubtext}>Waiting for customer to accept, reject, or counter</Text>
              </View>
            )}

            {/* Quote Accepted Status - Awaiting payment */}
            {currentQuote && currentQuote.status === 'ACCEPTED' && request.paymentStatus !== 'held' && (
              <View style={styles.quoteAcceptedSection}>
                <View style={styles.quoteAcceptedHeader}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.quoteAcceptedTitle}>Quote Accepted!</Text>
                </View>
                <Text style={styles.quoteAcceptedAmount}>${currentQuote.amount.toFixed(2)}</Text>
                <Text style={styles.quoteAcceptedSubtext}>Waiting for customer to complete payment</Text>
              </View>
            )}

            {/* Quote Rejected - Needs revision (show on Details) */}
            {currentQuote && currentQuote.status === 'REJECTED' && (
              <View style={styles.quoteRejectedSection}>
                <View style={styles.quoteRejectedSectionHeader}>
                  <Ionicons name="close-circle" size={20} color="#E53935" />
                  <Text style={styles.quoteRejectedSectionTitle}>Quote Rejected</Text>
                </View>
                <Text style={styles.quoteRejectedSectionAmount}>Your quote: ${currentQuote.amount.toFixed(2)}</Text>
                <TouchableOpacity
                  style={styles.reviseQuoteCTAButton}
                  onPress={openReviseModal}
                  disabled={sendingQuote}
                >
                  <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.reviseQuoteCTAButtonText}>Revise & Resend Quote</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Counter Offer - Show on Details */}
            {currentQuote && currentQuote.status === 'COUNTERED' && (
              <View style={styles.counterOfferSection}>
                <View style={styles.counterOfferSectionHeader}>
                  <Ionicons name="swap-horizontal" size={20} color="#FF9800" />
                  <Text style={styles.counterOfferSectionTitle}>Counter Offer Received</Text>
                </View>
                <View style={styles.counterOfferAmounts}>
                  <Text style={styles.counterOfferYours}>Your quote: ${currentQuote.amount.toFixed(2)}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#666" />
                  <Text style={styles.counterOfferTheirs}>Counter: ${currentQuote.counterAmount?.toFixed(2)}</Text>
                </View>
                {currentQuote.counterNote && (
                  <Text style={styles.counterOfferNote}>"{currentQuote.counterNote}"</Text>
                )}
                <TouchableOpacity
                  style={styles.reviseQuoteCTAButton}
                  onPress={openReviseModal}
                  disabled={sendingQuote}
                >
                  <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.reviseQuoteCTAButtonText}>Revise & Resend Quote</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Cancel Job Button - Only show when job is accepted AND no quote sent yet */}
            {request.status === 'accepted' && (!currentQuote || currentQuote.status === 'VOID') && (
              <TouchableOpacity
                style={styles.cancelJobButton}
                onPress={handleCancelJob}
                disabled={cancellingJob}
              >
                {cancellingJob ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.cancelJobButtonText}>Cancel Job</Text>
                  </>
                )}
              </TouchableOpacity>
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

            {/* Job Started Confirmation - Shows after job code verified (any in_progress or completed state) */}
            {['in_progress', 'completed', 'completed_pending_review', 'completed_reviewed'].includes(request.status) && (request.jobStartedAt || request.startedAt) && (
              <View style={styles.jobStartedSection}>
                <View style={styles.jobStartedHeader}>
                  <Ionicons name="play-circle" size={28} color="#2196F3" />
                  <Text style={styles.jobStartedTitle}>Job Started</Text>
                </View>
                <View style={styles.jobStartedDetails}>
                  {request.jobCode && (
                    <View style={styles.startedDetailRow}>
                      <Text style={styles.startedDetailLabel}>Start Code</Text>
                      <Text style={styles.startedDetailValue}>{request.jobCode}</Text>
                    </View>
                  )}
                  <View style={styles.startedDetailRow}>
                    <Text style={styles.startedDetailLabel}>Started At</Text>
                    <Text style={styles.startedDetailValue}>{formatDateTime(request.jobStartedAt || request.startedAt)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Job Completed Confirmation - Shows after successful completion (all completed states) */}
            {['completed', 'completed_pending_review', 'completed_reviewed'].includes(request.status) && (
              <View style={styles.jobCompletedSection}>
                <View style={styles.jobCompletedHeader}>
                  <Ionicons name="checkmark-done-circle" size={32} color="#4CAF50" />
                  <Text style={styles.jobCompletedTitle}>Job Completed</Text>
                </View>
                <View style={styles.jobCompletedDetails}>
                  {request.completionOtp && (
                    <View style={styles.completedDetailRow}>
                      <Text style={styles.completedDetailLabel}>Completion Code</Text>
                      <Text style={styles.completedDetailValue}>{request.completionOtp}</Text>
                    </View>
                  )}
                  {(request.jobCompletedAt || request.completedAt) && (
                    <View style={styles.completedDetailRow}>
                      <Text style={styles.completedDetailLabel}>Completed At</Text>
                      <Text style={styles.completedDetailValue}>{formatDateTime(request.jobCompletedAt || request.completedAt)}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.jobCompletedNote}>
                  This job has been successfully completed. The customer can now leave a review.
                </Text>
              </View>
            )}

            {/* PAYOUT SECTION - Shows for completed jobs (tappable to open full status screen) */}
            {['completed_pending_review', 'completed_reviewed', 'completed'].includes(request.status) && (
              <TouchableOpacity 
                style={styles.payoutSection}
                onPress={() => router.push({ pathname: '/provider-payout-status', params: { requestId: request._id } })}
                activeOpacity={0.7}
              >
                <View style={styles.payoutHeader}>
                  <Ionicons name="wallet-outline" size={24} color="#4CAF50" />
                  <Text style={styles.payoutTitle}>Payout</Text>
                  <Ionicons name="chevron-forward" size={20} color="#999" style={{ marginLeft: 'auto' }} />
                </View>
                {payoutInfo && payoutInfo.exists ? (
                  <View style={styles.payoutDetails}>
                    <View style={styles.payoutDetailRow}>
                      <Text style={styles.payoutDetailLabel}>Amount</Text>
                      <Text style={styles.payoutDetailValue}>
                        {payoutInfo.currency || 'TTD'} ${payoutInfo.amount?.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.payoutDetailRow}>
                      <Text style={styles.payoutDetailLabel}>Status</Text>
                      <View style={[
                        styles.payoutStatusBadge,
                        { backgroundColor: payoutInfo.status === 'released' ? '#E8F5E9' : '#FFF3E0' }
                      ]}>
                        <Text style={[
                          styles.payoutStatusText,
                          { color: payoutInfo.status === 'released' ? '#2E7D32' : '#E65100' }
                        ]}>
                          {payoutInfo.status === 'released' ? 'Released' : 
                           payoutInfo.status === 'on_hold' ? 'On Hold' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.payoutTapHint}>Tap to view full payout details</Text>
                  </View>
                ) : (
                  <Text style={styles.payoutPlaceholder}>
                    Payout information will appear here once available.
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* CUSTOMER REVIEW SECTION - Shows for completed jobs with a review */}
            {['completed_reviewed'].includes(request.status) && request.customerRating !== undefined && request.customerRating !== null && (
              <View style={styles.customerReviewSection}>
                <View style={styles.customerReviewHeader}>
                  <Text style={styles.customerReviewTitle}>Customer Review</Text>
                </View>
                <View style={styles.customerReviewStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= (request.customerRating || 0) ? 'star' : 'star-outline'}
                      size={28}
                      color="#FFB300"
                    />
                  ))}
                </View>
                {request.customerReview && (
                  <Text style={styles.customerReviewText}>"{request.customerReview}"</Text>
                )}
                <Text style={styles.customerReviewBy}>— {request.customerName}</Text>
              </View>
            )}

            {/* Waiting for Review - Show when job is completed but no review yet */}
            {['completed_pending_review'].includes(request.status) && (
              <View style={styles.waitingForReviewSection}>
                <View style={styles.waitingForReviewHeader}>
                  <Ionicons name="time-outline" size={20} color="#FF9800" />
                  <Text style={styles.waitingForReviewTitle}>Awaiting Customer Review</Text>
                </View>
                <Text style={styles.waitingForReviewSubtext}>
                  The customer has been asked to leave a review for this job.
                </Text>
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
          {canAcceptOrDecline && (
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
                messages.map((msg) => {
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
                  
                  return null;
                })
              )}
            </ScrollView>
          )}

          {/* Message Input or Read-Only Banner */}
          {/* CRITICAL FIX: Close chat for ALL completed states */}
          {(request.status === 'completed' || request.status === 'completed_pending_review' || request.status === 'completed_reviewed') ? (
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
                  <Text style={styles.paidJobCodeHint}>Payment secured. Start Code is collected ON-SITE. When you arrive at the job location, ask the customer to reveal the 6-digit Start Code to officially begin the job.</Text>
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
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.quoteModalContent}>
            <View style={styles.quoteModalHeader}>
              <Text style={styles.quoteModalTitle}>Send Quote</Text>
              <TouchableOpacity onPress={() => setShowQuoteModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.quoteModalScrollView}
              contentContainerStyle={styles.quoteModalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
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
              
              {/* Bottom padding for keyboard */}
              <View style={{ height: 40 }} />
            </ScrollView>
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
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.quoteModalContent}>
            <View style={styles.quoteModalHeader}>
              <Text style={styles.quoteModalTitle}>Revise Quote</Text>
              <TouchableOpacity onPress={() => setShowReviseModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.quoteModalScrollView}
              contentContainerStyle={styles.quoteModalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
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
              
              {/* Bottom padding for keyboard */}
              <View style={{ height: 40 }} />
            </ScrollView>
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
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C5DFFF',
  },
  jobCodeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1976D2',
    marginBottom: 4,
  },
  jobCodeHint: {
    fontSize: 12,
    color: '#5B8BD4',
    marginBottom: 12,
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
  // Send Quote CTA Section (on Details tab)
  sendQuoteCTASection: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFCC80',
    alignItems: 'center',
  },
  sendQuoteCTAHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sendQuoteCTATitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E53935',
  },
  sendQuoteCTASubtext: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  sendQuoteCTAButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E53935',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  sendQuoteCTAButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Quote Status Section (Sent/Pending)
  quoteStatusSection: {
    backgroundColor: '#FFF8E1',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFE082',
    alignItems: 'center',
  },
  quoteStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  quoteStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  quoteStatusAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 4,
  },
  quoteStatusSubtext: {
    fontSize: 12,
    color: '#666',
  },
  // Quote Accepted Section
  quoteAcceptedSection: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A5D6A7',
    alignItems: 'center',
  },
  quoteAcceptedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  quoteAcceptedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  quoteAcceptedAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 4,
  },
  quoteAcceptedSubtext: {
    fontSize: 12,
    color: '#558B2F',
  },
  // Quote Rejected Section (on Details)
  quoteRejectedSection: {
    backgroundColor: '#FFEBEE',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    alignItems: 'center',
  },
  quoteRejectedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  quoteRejectedSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E53935',
  },
  quoteRejectedSectionAmount: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  reviseQuoteCTAButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E53935',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  reviseQuoteCTAButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Counter Offer Section (on Details)
  counterOfferSection: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFCC80',
    alignItems: 'center',
  },
  counterOfferSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  counterOfferSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  counterOfferAmounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  counterOfferYours: {
    fontSize: 14,
    color: '#666',
  },
  counterOfferTheirs: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E65100',
  },
  counterOfferNote: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 12,
    textAlign: 'center',
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
  // Cancel Job Button
  cancelJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#757575',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  cancelJobButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
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
  // Job Completed Confirmation styles
  jobCompletedSection: {
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CE93D8',
  },
  jobCompletedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  jobCompletedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7B1FA2',
  },
  jobCompletedDetails: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  completedDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3E5F5',
  },
  completedDetailLabel: {
    fontSize: 14,
    color: '#666',
  },
  completedDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7B1FA2',
  },
  jobCompletedNote: {
    fontSize: 13,
    color: '#8E24AA',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Payout Section styles
  payoutSection: {
    backgroundColor: '#F1F8E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C5E1A5',
  },
  payoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  payoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#33691E',
  },
  payoutDetails: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  payoutDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F5E9',
  },
  payoutDetailLabel: {
    fontSize: 14,
    color: '#666',
  },
  payoutDetailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  payoutStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  payoutStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  payoutHelperText: {
    fontSize: 13,
    color: '#558B2F',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  payoutTapHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
  },
  payoutPlaceholder: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  // Job Started Confirmation styles
  jobStartedSection: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  jobStartedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  jobStartedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1565C0',
  },
  jobStartedDetails: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  startedDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E3F2FD',
  },
  startedDetailLabel: {
    fontSize: 14,
    color: '#666',
  },
  startedDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
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
    paddingBottom: 20,
    maxHeight: '85%',
  },
  quoteModalScrollView: {
    flexGrow: 0,
  },
  quoteModalScrollContent: {
    paddingBottom: 20,
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
  // Customer Review Section Styles
  customerReviewSection: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  customerReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  customerReviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
  },
  customerReviewStars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  customerReviewText: {
    fontSize: 15,
    color: '#78350F',
    fontStyle: 'italic',
    lineHeight: 22,
    marginBottom: 8,
  },
  customerReviewBy: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '500',
    textAlign: 'right',
  },
  // Waiting for Review Section Styles
  waitingForReviewSection: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  waitingForReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  waitingForReviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C2410C',
  },
  waitingForReviewSubtext: {
    fontSize: 14,
    color: '#9A3412',
    lineHeight: 20,
  },
});
