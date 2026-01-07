import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface UploadState {
  profilePhoto: string | null;
  governmentIdFront: string | null;
  governmentIdBack: string | null;
}

interface UploadingState {
  profilePhoto: boolean;
  governmentIdFront: boolean;
  governmentIdBack: boolean;
}

export default function ProviderUploadsScreen() {
  const router = useRouter();
  const { token, refreshUser } = useAuth();
  
  const [uploads, setUploads] = useState<UploadState>({
    profilePhoto: null,
    governmentIdFront: null,
    governmentIdBack: null,
  });
  
  const [uploading, setUploading] = useState<UploadingState>({
    profilePhoto: false,
    governmentIdFront: false,
    governmentIdBack: false,
  });
  
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [completing, setCompleting] = useState(false);

  // Check for existing uploads on mount
  useEffect(() => {
    fetchExistingUploads();
  }, []);

  const fetchExistingUploads = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/providers/me/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const provider = response.data;
      setUploads({
        profilePhoto: provider.profilePhotoUrl || null,
        governmentIdFront: provider.governmentIdFrontUrl || null,
        governmentIdBack: provider.governmentIdBackUrl || null,
      });
    } catch (error) {
      // Provider profile may not exist yet, that's ok
      console.log('No existing provider profile found');
    } finally {
      setLoadingExisting(false);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera and photo library access is needed to upload photos.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  };

  const pickImage = async (type: 'profilePhoto' | 'governmentIdFront' | 'governmentIdBack', source: 'camera' | 'library') => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      let result;
      
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: type === 'profilePhoto' ? [1, 1] : [4, 3],
          quality: 0.7,
          base64: true,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: type === 'profilePhoto' ? [1, 1] : [4, 3],
          quality: 0.7,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await uploadImage(type, asset.base64 || '', asset.uri);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('Image picker error:', error);
      }
      Alert.alert('Unable to Select Image', 'We couldn\'t access your photos. Please try again.');
    }
  };

  const showImageSourceOptions = (type: 'profilePhoto' | 'governmentIdFront' | 'governmentIdBack') => {
    Alert.alert(
      type === 'profilePhoto' ? 'Profile Photo' : 'Government ID',
      'Choose image source',
      [
        {
          text: 'Take Photo',
          onPress: () => pickImage(type, 'camera'),
        },
        {
          text: 'Choose from Library',
          onPress: () => pickImage(type, 'library'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const uploadImage = async (type: 'profilePhoto' | 'governmentIdFront' | 'governmentIdBack', base64Data: string, uri: string) => {
    const uploadTypeMap = {
      profilePhoto: 'profile_photo',
      governmentIdFront: 'government_id_front',
      governmentIdBack: 'government_id_back',
    };

    setUploading((prev) => ({ ...prev, [type]: true }));

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/providers/me/upload`,
        {
          imageData: base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${base64Data}`,
          uploadType: uploadTypeMap[type],
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Update local state with the returned URL
      const provider = response.data;
      setUploads({
        profilePhoto: provider.profilePhotoUrl || uploads.profilePhoto,
        governmentIdFront: provider.governmentIdFrontUrl || uploads.governmentIdFront,
        governmentIdBack: provider.governmentIdBackUrl || uploads.governmentIdBack,
      });

      // If all uploads complete, show success
      if (provider.uploadsComplete) {
        await refreshUser();
      }
    } catch (error: any) {
      if (__DEV__) {
        console.warn('Upload error:', error);
      }
      Alert.alert(
        'Upload Failed',
        'We couldn\'t upload your image. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const allUploadsComplete = uploads.profilePhoto && uploads.governmentIdFront && uploads.governmentIdBack;

  const handleComplete = async () => {
    if (!allUploadsComplete) {
      Alert.alert('Uploads Required', 'Please upload all required photos to complete your profile.');
      return;
    }

    setCompleting(true);
    try {
      await refreshUser();
      router.replace('/(provider)/dashboard');
    } catch (error) {
      if (__DEV__) {
        console.warn('Error completing setup:', error);
      }
      Alert.alert('Setup Incomplete', 'We couldn\'t complete your setup. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const renderUploadBox = (
    type: 'profilePhoto' | 'governmentIdFront' | 'governmentIdBack',
    title: string,
    description: string,
    iconName: string,
    isSquare: boolean = false
  ) => {
    const isUploading = uploading[type];
    const imageUrl = uploads[type];
    const hasImage = !!imageUrl;

    return (
      <View style={styles.uploadSection}>
        <View style={styles.uploadHeader}>
          <Text style={styles.uploadTitle}>
            {title} <Text style={styles.required}>*</Text>
          </Text>
          <Text style={styles.uploadDescription}>{description}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.uploadBox,
            isSquare && styles.uploadBoxSquare,
            hasImage && styles.uploadBoxWithImage,
          ]}
          onPress={() => showImageSourceOptions(type)}
          disabled={isUploading}
        >
          {isUploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="large" color="#E53935" />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          ) : hasImage ? (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: imageUrl.startsWith('/') ? `${BACKEND_URL}${imageUrl}` : imageUrl }}
                style={[styles.uploadedImage, isSquare && styles.uploadedImageSquare]}
                resizeMode="cover"
              />
              <View style={styles.replaceOverlay}>
                <Ionicons name="camera" size={24} color="#FFFFFF" />
                <Text style={styles.replaceText}>Replace</Text>
              </View>
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
              </View>
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name={iconName as any} size={32} color="#E53935" />
              </View>
              <Text style={styles.placeholderText}>Tap to upload</Text>
              <Text style={styles.placeholderHint}>Camera or gallery</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loadingExisting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E53935" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark" size={48} color="#E53935" />
          </View>
          <Text style={styles.title}>Verify Your Identity</Text>
          <Text style={styles.subtitle}>
            Upload your photo and ID to build trust with customers and start receiving jobs.
          </Text>
        </View>

        <View style={styles.trustBadge}>
          <Ionicons name="lock-closed" size={18} color="#2E7D32" />
          <Text style={styles.trustText}>
            Your ID is stored securely and never shared with customers.
          </Text>
        </View>

        {renderUploadBox(
          'profilePhoto',
          'Profile Photo',
          'A clear photo of your face. This will be shown to customers.',
          'person-circle',
          true
        )}

        {renderUploadBox(
          'governmentIdFront',
          'Government ID (Front)',
          'Driver\'s license, national ID, or passport - front side.',
          'card'
        )}

        {renderUploadBox(
          'governmentIdBack',
          'Government ID (Back)',
          'Back side of your ID document.',
          'card-outline'
        )}

        <View style={styles.statusSection}>
          <Text style={styles.statusTitle}>Upload Status</Text>
          <View style={styles.statusList}>
            <View style={styles.statusItem}>
              <Ionicons
                name={uploads.profilePhoto ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={uploads.profilePhoto ? '#4CAF50' : '#999'}
              />
              <Text style={[styles.statusItemText, uploads.profilePhoto && styles.statusItemComplete]}>
                Profile Photo
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Ionicons
                name={uploads.governmentIdFront ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={uploads.governmentIdFront ? '#4CAF50' : '#999'}
              />
              <Text style={[styles.statusItemText, uploads.governmentIdFront && styles.statusItemComplete]}>
                ID Front
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Ionicons
                name={uploads.governmentIdBack ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={uploads.governmentIdBack ? '#4CAF50' : '#999'}
              />
              <Text style={[styles.statusItemText, uploads.governmentIdBack && styles.statusItemComplete]}>
                ID Back
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            !allUploadsComplete && styles.completeButtonDisabled,
          ]}
          onPress={handleComplete}
          disabled={!allUploadsComplete || completing}
        >
          {completing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.completeButtonText}>
                {allUploadsComplete ? 'Complete Setup' : 'Upload All Photos to Continue'}
              </Text>
              {allUploadsComplete && <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />}
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    gap: 8,
  },
  trustText: {
    flex: 1,
    fontSize: 13,
    color: '#2E7D32',
    lineHeight: 18,
  },
  uploadSection: {
    marginBottom: 24,
  },
  uploadHeader: {
    marginBottom: 12,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  required: {
    color: '#E53935',
  },
  uploadDescription: {
    fontSize: 13,
    color: '#666',
  },
  uploadBox: {
    height: 160,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uploadBoxSquare: {
    height: 180,
  },
  uploadBoxWithImage: {
    borderStyle: 'solid',
    borderColor: '#4CAF50',
  },
  placeholderContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  placeholderHint: {
    fontSize: 13,
    color: '#999',
  },
  uploadingContainer: {
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#E53935',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  uploadedImageSquare: {
    borderRadius: 8,
  },
  replaceOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  replaceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  statusSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  statusList: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusItemText: {
    fontSize: 13,
    color: '#999',
  },
  statusItemComplete: {
    color: '#4CAF50',
    fontWeight: '500',
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
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    minHeight: 56,
  },
  completeButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
