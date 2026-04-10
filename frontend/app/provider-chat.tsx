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
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Data model: Chat only (text + image). No system/quote/payment types. ───
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

export default function ProviderChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();

  const requestId = params.requestId as string;
  const customerName = params.customerName as string | undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [chatClosed, setChatClosed] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevMessageCountRef = useRef(0);

  // ─── Fetch chat messages (text + image only) ────────────────────────────────
  const fetchMessages = useCallback(async (showLoading = true) => {
    if (!requestId) return;

    if (showLoading && messages.length === 0) {
      setLoadingMessages(true);
    }
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/service-requests/${requestId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const allMessages: any[] = response.data.messages || [];

      // Keep ONLY human-to-human messages: type text or image, senderRole customer or provider
      const chatMessages: Message[] = allMessages.filter((m) => {
        const isHuman =
          m.senderRole === 'customer' || m.senderRole === 'provider';
        const isChatType =
          !m.type ||
          m.type === 'text' ||
          m.type === 'image' ||
          !!m.imageUrl;
        const isSystem =
          m.type === 'system' ||
          m.senderRole === 'system' ||
          m.senderName === 'Fixr';
        return isHuman && isChatType && !isSystem;
      });

      setMessages((prev) => {
        const prevIds = new Set(prev.map((m) => m._id));
        const nextIds = new Set(chatMessages.map((m) => m._id));
        const same =
          prev.length === chatMessages.length &&
          chatMessages.every((m) => prevIds.has(m._id)) &&
          prev.every((m) => nextIds.has(m._id));
        return same ? prev : chatMessages;
      });

      // Scroll to end when new messages arrive
      if (
        chatMessages.length > 0 &&
        chatMessages.length > prevMessageCountRef.current &&
        prevMessageCountRef.current > 0
      ) {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
      prevMessageCountRef.current = chatMessages.length;
    } catch (err) {
      // silent
    } finally {
      setLoadingMessages(false);
    }
  }, [requestId, token, messages.length]);

  // ─── Mark messages as read ───────────────────────────────────────────────────
  const markMessagesAsRead = useCallback(async () => {
    if (!requestId) return;
    try {
      await axios.post(
        `${BACKEND_URL}/api/messages/mark-read`,
        { jobId: requestId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      // silent
    }
  }, [requestId, token]);

  // ─── Focus effect: initial fetch + polling ───────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      fetchMessages(true);
      markMessagesAsRead();

      // Poll every 3 seconds while screen is focused
      pollingIntervalRef.current = setInterval(() => {
        fetchMessages(false);
        markMessagesAsRead();
      }, 3000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }, [requestId, token])
  );

  // ─── Send text message ───────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !requestId) return;
    if (chatClosed) {
      Alert.alert('Chat Closed', 'Chat is read-only after job completion.');
      return;
    }

    const messageText = newMessage.trim();
    Keyboard.dismiss();

    // Optimistic UI
    const optimisticMessage: Message = {
      _id: `temp_${Date.now()}`,
      senderId: user?._id || '',
      senderName: user?.name || 'You',
      senderRole: 'provider',
      type: 'text',
      text: messageText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);

    setSendingMessage(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/service-requests/${requestId}/messages`,
        { type: 'text', text: messageText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchMessages(false);
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m._id !== optimisticMessage._id));
      setNewMessage(messageText);

      if (err.response?.status === 403) {
        Alert.alert('Chat Closed', 'Chat is read-only after job completion.');
        setChatClosed(true);
      } else {
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
    } finally {
      setSendingMessage(false);
    }
  };

  // ─── Image handling ──────────────────────────────────────────────────────────
  const handlePickImage = async () => {
    if (chatClosed) {
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
    });
    if (!result.canceled && result.assets[0]) {
      uploadAndSendImage(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    if (chatClosed) {
      Alert.alert('Chat Closed', 'Chat is read-only after job completion.');
      return;
    }
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      uploadAndSendImage(result.assets[0].uri);
    }
  };

  const uploadAndSendImage = async (imageUri: string) => {
    if (!requestId) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'photo.jpg';
      const match = /\.(w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('file', { uri: imageUri, name: filename, type } as any);

      const uploadResponse = await axios.post(
        `${BACKEND_URL}/api/uploads/image`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const imageUrl = uploadResponse.data.url;

      await axios.post(
        `${BACKEND_URL}/api/service-requests/${requestId}/messages`,
        { type: 'image', imageUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await fetchMessages(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const showImageOptions = () => {
    // Block image upload for ALL completed states (provider behaviour)
    const completedStates = ['completed', 'completed_pending_review', 'completed_reviewed'];
    if (chatClosed) {
      Alert.alert('Chat Closed', 'Chat is read-only after job completion.');
      return;
    }
    Alert.alert('Send Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: handleTakePhoto },
      { text: 'Choose from Library', onPress: handlePickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1}>
            {customerName ? `Chat with ${customerName}` : 'Chat'}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Chat area */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loadingMessages ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#E53935" />
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: false })
            }
          >
            {messages.length === 0 ? (
              <View style={styles.emptyChatInner}>
                <Ionicons name="chatbubbles-outline" size={48} color="#CCC" />
                <Text style={styles.emptyChatTitle}>No messages yet</Text>
                <Text style={styles.emptyChatText}>
                  Keep all job communication in one place
                </Text>
              </View>
            ) : (
              messages.map((msg) => {
                const isMine = msg.senderId === user?._id;
                const isImage = (msg.type === 'image' || !!msg.imageUrl) && !!msg.imageUrl;
                const imageUri = isImage ? `${BACKEND_URL}${msg.imageUrl}` : '';

                return (
                  <View
                    key={msg._id}
                    style={[
                      styles.messageBubble,
                      isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs,
                      isImage && styles.imageBubble,
                    ]}
                  >
                    {!isMine && (
                      <Text style={styles.messageSender}>{msg.senderName}</Text>
                    )}
                    {isImage ? (
                      <TouchableOpacity onPress={() => setFullScreenImage(imageUri)}>
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.messageImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ) : (
                      <Text
                        style={[
                          styles.messageText,
                          isMine && styles.messageTextMine,
                        ]}
                      >
                        {msg.text}
                      </Text>
                    )}
                    <View style={styles.messageFooter}>
                      <Text
                        style={[
                          styles.messageTime,
                          isMine && styles.messageTimeMine,
                        ]}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      {isMine && (
                        <>
                          {msg.readAt ? (
                            <View style={styles.ticksRow}>
                              <Ionicons name="checkmark" size={14} color="#4FC3F7" />
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color="#4FC3F7"
                                style={styles.secondTick}
                              />
                            </View>
                          ) : msg.deliveredAt ? (
                            <View style={styles.ticksRow}>
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color="rgba(255,255,255,0.6)"
                              />
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color="rgba(255,255,255,0.6)"
                                style={styles.secondTick}
                              />
                            </View>
                          ) : (
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color="rgba(255,255,255,0.5)"
                            />
                          )}
                        </>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* Input bar */}
        {chatClosed ? (
          <View style={styles.chatClosedBanner}>
            <Ionicons name="lock-closed" size={16} color="#666" />
            <Text style={styles.chatClosedText}>
              Chat is read-only after job completion
            </Text>
          </View>
        ) : (
          <View style={styles.messageInputContainer}>
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
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              multiline
              maxLength={2000}
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!newMessage.trim() || sendingMessage) && styles.sendButtonDisabled,
              ]}
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

      {/* Full-screen image modal */}
      <Modal
        visible={!!fullScreenImage}
        transparent
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
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  chatContainer: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
    paddingBottom: 8,
    flexGrow: 1,
  },
  emptyChatInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 300,
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
    textAlign: 'center',
  },
  messageBubble: {
    maxWidth: '80%',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  messageBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#E53935',
    borderBottomRightRadius: 4,
  },
  messageBubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: 4,
  },
  imageBubble: {
    padding: 4,
    backgroundColor: 'transparent',
  },
  messageSender: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  messageTextMine: {
    color: '#FFFFFF',
  },
  messageImage: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.6,
    borderRadius: 12,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
    gap: 2,
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
  },
  messageTimeMine: {
    color: 'rgba(255,255,255,0.7)',
  },
  ticksRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondTick: {
    marginLeft: -6,
  },
  messageInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    gap: 8,
    alignItems: 'flex-end',
  },
  imagePickerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    marginBottom: 2,
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
    marginBottom: 0,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
  chatClosedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 6,
  },
  chatClosedText: {
    fontSize: 13,
    color: '#666',
  },
  fullScreenImageContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.2,
  },
});
