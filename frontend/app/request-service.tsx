import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function RequestServiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();
  const providerId = params.providerId as string;
  const category = params.category as string;
  const subCategory = params.subCategory as string | undefined;
  const location = params.location as string | undefined;

  // Check if this is a general request (no specific provider)
  const isGeneralRequest = providerId === 'general' || category === 'other';

  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeError, setTimeError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Phase 3A: Provider unavailable modal
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);

  const categoryNames: { [key: string]: string } = {
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    ac: 'AC Repair',
    cleaning: 'Cleaning',
    handyman: 'Handyman',
    other: 'Other Services (Beta)',
  };

  const formatTime12Hour = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios'); // Keep open on iOS
    if (selectedTime) {
      setSelectedTime(selectedTime);
      setTimeError('');
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!description.trim()) {
      Alert.alert('Required Field', 'Please provide a description of the service needed.');
      return;
    }

    if (!selectedTime) {
      setTimeError('Please select a preferred time');
      Alert.alert('Required Field', 'Please select a preferred time for the service.');
      return;
    }

    setLoading(true);
    try {
      // Format date properly
      const dateStr = formatDate(selectedDate);
      
      // Convert selected time to 24-hour format
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      
      // Combine in ISO format
      const preferredDateTime = `${dateStr}T${timeStr}:00.000Z`;

      // Build API URL - for general requests, use 'general' as provider_id
      const apiUrl = isGeneralRequest 
        ? `${BACKEND_URL}/api/service-requests?provider_id=general`
        : `${BACKEND_URL}/api/service-requests?provider_id=${providerId}`;

      await axios.post(
        apiUrl,
        {
          service: category,
          description: description.trim(),
          preferredDateTime,
          subCategory: subCategory || null,
          location: location || null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Navigate to confirmation
      router.replace({
        pathname: '/request-confirmation',
        params: { category: categoryNames[category] || category },
      });
    } catch (error: any) {
      console.error('Error creating request:', error);
      
      // Phase 3A: Check if provider is unavailable
      const errorMessage = error.response?.data?.detail || '';
      if (errorMessage.toLowerCase().includes('unavailable') || 
          errorMessage.toLowerCase().includes('not accepting')) {
        setShowUnavailableModal(true);
      } else {
        Alert.alert(
          'Request Failed',
          errorMessage || 'Failed to submit service request. Please try again.'
        );
      }
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
          <Text style={styles.title}>Request Service</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Service Category</Text>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyText}>
                  {categoryNames[category] || category}
                </Text>
              </View>
            </View>

            {/* Show sub-category if present (for Handyman) */}
            {subCategory && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Service Type</Text>
                <View style={styles.readOnlyInput}>
                  <Text style={styles.readOnlyText}>{subCategory}</Text>
                </View>
              </View>
            )}

            {/* Show location if present */}
            {location && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Service Location</Text>
                <View style={styles.readOnlyInputWithIcon}>
                  <Ionicons name="location-outline" size={18} color="#E53935" />
                  <Text style={styles.readOnlyText}>{location}</Text>
                </View>
              </View>
            )}

            {isGeneralRequest && (
              <View style={styles.betaNotice}>
                <Ionicons name="information-circle" size={20} color="#F57C00" />
                <Text style={styles.betaNoticeText}>
                  Use this option if your service doesn't fit the listed categories. Availability may be limited during beta.
                </Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Description <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={isGeneralRequest 
                  ? "Describe the service you need in detail (e.g., furniture assembly, garden work, moving help)"
                  : "Describe the service you need (e.g., fix leaking faucet, install new outlet)"
                }
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preferred Date</Text>
              <TouchableOpacity
                style={styles.timePickerButton}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={20} color="#666" style={styles.inputIcon} />
                <Text style={styles.timePickerTextSelected}>
                  {formatDate(selectedDate)}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={onDateChange}
                minimumDate={new Date()}
              />
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Preferred Time <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.timePickerButton, timeError ? styles.timePickerError : null]}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={20} color="#666" style={styles.inputIcon} />
                <Text style={selectedTime ? styles.timePickerTextSelected : styles.timePickerText}>
                  {selectedTime ? formatTime12Hour(selectedTime) : 'Select time'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
              {timeError ? (
                <Text style={styles.errorText}>{timeError}</Text>
              ) : null}
            </View>

            {showTimePicker && (
              <DateTimePicker
                value={selectedTime || new Date()}
                mode="time"
                is24Hour={false}
                display="default"
                onChange={onTimeChange}
              />
            )}

            <Text style={styles.note}>
              Note: The provider will review your request and respond accordingly.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Request</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Provider Unavailable Modal - Phase 3A */}
      <Modal
        visible={showUnavailableModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowUnavailableModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="person-remove-outline" size={48} color="#E53935" />
            </View>
            
            <Text style={styles.modalTitle}>Provider Unavailable</Text>
            <Text style={styles.modalMessage}>
              This Fixr isn't accepting new jobs right now. Please choose another provider.
            </Text>
            
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowUnavailableModal(false);
                router.back();
              }}
            >
              <Text style={styles.modalButtonText}>Back to Providers</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 120,
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  required: {
    color: '#E53935',
  },
  readOnlyInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  readOnlyInputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  readOnlyText: {
    fontSize: 16,
    color: '#666',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1A1A1A',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 16,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 56,
  },
  timePickerError: {
    borderColor: '#E53935',
  },
  timePickerText: {
    flex: 1,
    fontSize: 16,
    color: '#999',
  },
  timePickerTextSelected: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    color: '#E53935',
    marginTop: 4,
  },
  note: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  betaNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE082',
    gap: 12,
  },
  betaNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#E65100',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  submitButton: {
    backgroundColor: '#E53935',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});