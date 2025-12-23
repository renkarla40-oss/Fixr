import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const feedbackTypes = [
  { id: 'suggestion', label: 'Suggestion', icon: 'bulb-outline' },
  { id: 'bug', label: 'Bug Report', icon: 'bug-outline' },
  { id: 'compliment', label: 'Compliment', icon: 'heart-outline' },
  { id: 'other', label: 'Other', icon: 'chatbubble-outline' },
];

export default function FeedbackScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [selectedType, setSelectedType] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select a feedback type');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter your feedback');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/feedback`,
        {
          type: 'feedback',
          subject: selectedType,
          message: message.trim(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert(
        'Thank You!',
        'Your feedback has been submitted. We appreciate you helping us improve Fixr!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.title}>Feedback</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.infoSection}>
            <View style={styles.iconContainer}>
              <Ionicons name="chatbubbles" size={32} color="#E53935" />
            </View>
            <Text style={styles.infoTitle}>We'd love to hear from you!</Text>
            <Text style={styles.infoText}>
              Your feedback helps us make Fixr better for everyone.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>What's your feedback about?</Text>
          <View style={styles.typeGrid}>
            {feedbackTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  selectedType === type.id && styles.typeCardSelected,
                ]}
                onPress={() => setSelectedType(type.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={type.icon as any}
                  size={24}
                  color={selectedType === type.id ? '#E53935' : '#666'}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    selectedType === type.id && styles.typeLabelSelected,
                  ]}
                >
                  {type.label}
                </Text>
                {selectedType === type.id && (
                  <View style={styles.checkIcon}>
                    <Ionicons name="checkmark-circle" size={20} color="#E53935" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Your feedback</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Tell us what you think..."
            placeholderTextColor="#999"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Feedback</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  infoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  typeCard: {
    width: '47%',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  typeCardSelected: {
    backgroundColor: '#FFF5F5',
    borderColor: '#E53935',
  },
  typeLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  typeLabelSelected: {
    color: '#E53935',
    fontWeight: '600',
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  textArea: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 120,
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#E53935',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
