import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getServiceLabel } from '../constants/serviceCategories';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface ServiceRequest {
  _id: string;
  service: string;
  providerName: string;
  providerId?: string;
  status: string;
  customerRating?: number;
  customerReview?: string;
}

export default function LeaveReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const requestId = params.requestId as string;

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [existingReview, setExistingReview] = useState<{ rating: number; comment?: string } | null>(null);

  useEffect(() => {
    if (requestId) {
      fetchRequestAndReview();
    } else {
      setLoading(false);
    }
  }, [requestId, token]);

  const fetchRequestAndReview = async () => {
    try {
      // Fetch request details
      const requestResponse = await axios.get(
        `${BACKEND_URL}/api/service-requests/${requestId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const requestData = requestResponse.data;
      setRequest(requestData);

      // Check if review already exists from the request data
      if (requestData.customerRating !== null && requestData.customerRating !== undefined) {
        setExistingReview({
          rating: requestData.customerRating,
          comment: requestData.customerReview,
        });
      }
    } catch (err) {
      console.log('Error fetching request:', err);
      Alert.alert('Error', 'Could not load job details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      // Use the correct endpoint: /api/service-requests/{request_id}/review
      await axios.post(
        `${BACKEND_URL}/api/service-requests/${requestId}/review`,
        {
          rating: rating,
          review: comment.trim() || '',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert(
        'Thank You!',
        'Your review has been submitted successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.replace({ pathname: '/(customer)/request-detail', params: { requestId } }),
          },
        ]
      );
    } catch (err: any) {
      console.log('Submit review error:', err);
      if (err.response?.data?.alreadyReviewed || err.response?.data?.detail?.includes('already')) {
        Alert.alert('Already Reviewed', 'You have already submitted a review for this job.');
        router.replace({ pathname: '/(customer)/request-detail', params: { requestId } });
      } else {
        Alert.alert('Error', 'Could not submit review. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    // Call skip-review endpoint to properly transition the job state
    try {
      await axios.post(
        `${BACKEND_URL}/api/service-requests/${requestId}/skip-review`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.log('Skip review error (non-critical):', err);
      // Even if it fails, navigate back - user chose to skip
    }
    router.replace({ pathname: '/(customer)/request-detail', params: { requestId } });
  };

  const handleGoBack = () => {
    router.back();
  };

  // Star rating component
  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => setRating(i)}
          style={styles.starButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name={i <= rating ? 'star' : 'star-outline'}
            size={44}
            color={i <= rating ? '#FFB300' : '#CCC'}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 120 }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#E53935" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // If review already exists, show confirmation and redirect
  if (existingReview) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 120 }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleGoBack}>
            <Ionicons name="close" size={28} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Submitted</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centerContent}>
          <View style={styles.thankYouContainer}>
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            <Text style={styles.thankYouTitle}>Thank You!</Text>
            <Text style={styles.thankYouText}>
              You've already submitted a review for this job.
            </Text>
            <View style={styles.existingRatingContainer}>
              <Text style={styles.existingRatingLabel}>Your Rating</Text>
              <View style={styles.existingStars}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Ionicons
                    key={i}
                    name={i <= existingReview.rating ? 'star' : 'star-outline'}
                    size={28}
                    color={i <= existingReview.rating ? '#FFB300' : '#CCC'}
                  />
                ))}
              </View>
              {existingReview.comment && (
                <Text style={styles.existingComment}>"{existingReview.comment}"</Text>
              )}
            </View>
            <TouchableOpacity style={styles.backToJobButton} onPress={handleGoBack}>
              <Text style={styles.backToJobButtonText}>Back to Job Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 120 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleGoBack}>
          <Ionicons name="close" size={28} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leave a Review</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 140 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Provider Info Card */}
          <View style={styles.providerCard}>
            <View style={styles.providerIconContainer}>
              <Ionicons name="person-circle" size={64} color="#E53935" />
            </View>
            <Text style={styles.providerName}>{request?.providerName || 'Service Provider'}</Text>
            <Text style={styles.serviceType}>{getServiceLabel(request?.service || '')}</Text>
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.completedBadgeText}>Job Completed</Text>
            </View>
          </View>

          {/* Rating Section */}
          <View style={styles.ratingSection}>
            <Text style={styles.ratingTitle}>How was your experience?</Text>
            <Text style={styles.ratingSubtitle}>Tap to rate</Text>
            <View style={styles.starsContainer}>{renderStars()}</View>
            {rating > 0 && (
              <Text style={styles.ratingLabel}>
                {rating === 5
                  ? 'Excellent!'
                  : rating === 4
                  ? 'Great!'
                  : rating === 3
                  ? 'Good'
                  : rating === 2
                  ? 'Fair'
                  : 'Poor'}
              </Text>
            )}
          </View>

          {/* Comment Section */}
          <View style={styles.commentSection}>
            <Text style={styles.commentLabel}>Add a comment (optional)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Tell us about your experience..."
              placeholderTextColor="#999"
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>{comment.length}/500</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
              onPress={handleSubmitReview}
              disabled={rating === 0 || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="star" size={20} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Submit Review</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex1: {
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
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  placeholder: {
    width: 44,
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
  scrollContent: {
    padding: 24,
  },
  providerCard: {
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  providerIconContainer: {
    marginBottom: 12,
  },
  providerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  serviceType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  completedBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  ratingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  ratingSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E53935',
    marginTop: 8,
  },
  commentSection: {
    marginBottom: 32,
  },
  commentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  commentInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
  },
  actionsContainer: {
    gap: 12,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  // Thank you / existing review styles
  thankYouContainer: {
    alignItems: 'center',
  },
  thankYouTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  thankYouText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  existingRatingContainer: {
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    marginBottom: 24,
  },
  existingRatingLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  existingStars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  existingComment: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  backToJobButton: {
    backgroundColor: '#E53935',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  backToJobButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
