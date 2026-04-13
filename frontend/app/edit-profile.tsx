import React, { useState, useEffect } from 'react';
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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, token, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Determine if user is currently in provider role
  const isProvider = user?.currentRole === 'provider';

  // Fetch current profile photo on mount (provider or customer)
  useEffect(() => {
    const fetchProfilePhoto = async () => {
      try {
        if (isProvider) {
          // Fetch from provider profile
          const response = await axios.get(`${BACKEND_URL}/api/providers/me/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setProfilePhotoUrl(response.data?.profilePhotoUrl || null);
        } else {
          // Use customer's profilePhotoUrl from user object
          setProfilePhotoUrl((user as any)?.profilePhotoUrl || null);
        }
      } catch (error) {
        console.warn('Could not fetch profile photo:', error);
        // Fallback to user object
        setProfilePhotoUrl((user as any)?.profilePhotoUrl || null);
      } finally {
        setInitialLoading(false);
      }
    };
    
    fetchProfilePhoto();
  }, [isProvider, token, user]);

  const handlePickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to upload a profile photo.'
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      
      if (!asset.base64) {
        Alert.alert('Error', 'Failed to process the image. Please try again.');
        return;
      }

      // Check file size (base64 is ~33% larger than binary)
      const estimatedSize = asset.base64.length * 0.75;
      if (estimatedSize > 5 * 1024 * 1024) {
        Alert.alert('Image Too Large', 'Please select an image smaller than 5MB.');
        return;
      }

      // Show local preview immediately while uploading
      const localPreviewUri = asset.uri;
      setProfilePhotoUrl(localPreviewUri);
      
      // Upload the image
      setPhotoLoading(true);
      
      // Determine mime type from URI
      const mimeType = asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const imageData = `data:${mimeType};base64,${asset.base64}`;

      // Use different endpoint based on user role
      const uploadEndpoint = isProvider 
        ? `${BACKEND_URL}/api/providers/me/upload`
        : `${BACKEND_URL}/api/users/upload-profile-photo`;
      
      const uploadPayload = isProvider 
        ? { imageData, uploadType: 'profile_photo' }
        : { imageData };

      console.log('[PHOTO UPLOAD] Endpoint:', uploadEndpoint);
      console.log('[PHOTO UPLOAD] isProvider:', isProvider);

      const response = await axios.post(
        uploadEndpoint,
        uploadPayload,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      // Provider endpoint returns Provider object directly with profilePhotoUrl
      // Customer endpoint returns { success: true, profilePhotoUrl: ... }
      let newPhotoUrl: string | null = null;
      
      if (isProvider) {
        newPhotoUrl = response.data?.profilePhotoUrl || null;
      } else {
        if (response.data.success) {
          newPhotoUrl = response.data.profilePhotoUrl;
        }
      }
      
      if (newPhotoUrl) {
        // Add cache-busting timestamp to force reload
        const cacheBustedUrl = newPhotoUrl.includes('?') 
          ? `${newPhotoUrl}&v=${Date.now()}`
          : `${newPhotoUrl}?v=${Date.now()}`;
        setProfilePhotoUrl(cacheBustedUrl);
        // Refresh user data after alert is dismissed - this ensures we stay on edit-profile
        // until user taps OK, then the profile screen will show the updated photo
        Alert.alert('Success', 'Profile photo updated!', [
          { text: 'OK', onPress: () => refreshUser() }
        ]);
      } else {
        // Revert to previous photo if upload didn't return a URL
        console.log('[PHOTO UPLOAD] No URL returned, reverting preview');
        Alert.alert('Error', 'Photo upload failed - no URL returned. Please try again.');
      }
    } catch (error: any) {
      console.error('[PHOTO UPLOAD] Error:', error?.message || error);
      console.error('[PHOTO UPLOAD] Error response:', error.response?.data);
      const message = error.response?.data?.detail || error.message || 'Failed to upload photo. Please try again.';
      Alert.alert('Upload Failed', message);
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Error', 'Phone number is required');
      return;
    }

    setLoading(true);
    try {
      await axios.patch(
        `${BACKEND_URL}/api/users/profile`,
        {
          name: name.trim(),
          phone: phone.trim(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await refreshUser();
      
      Alert.alert(
        'Success',
        'Your profile has been updated.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      if (__DEV__) {
        console.warn('Error updating profile:', error);
      }
      Alert.alert('Update Failed', 'We couldn\'t save your changes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Build full photo URL
  const getPhotoUrl = () => {
    if (!profilePhotoUrl) return null;
    if (profilePhotoUrl.startsWith('http')) return profilePhotoUrl;
    return `${BACKEND_URL}${profilePhotoUrl}`;
  };

  const photoUrl = getPhotoUrl();

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
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={28} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Profile</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarSection}>
            <TouchableOpacity 
              onPress={handlePickImage}
              disabled={photoLoading}
              activeOpacity={0.7}
            >
              <View style={styles.avatarContainer}>
                {photoLoading ? (
                  <ActivityIndicator size="large" color="#D74826" />
                ) : photoUrl ? (
                  <Image 
                    source={{ uri: photoUrl }} 
                    style={styles.avatarImage}
                  />
                ) : (
                  <Ionicons name="person" size={48} color="#666" />
                )}
                <View style={styles.cameraIconContainer}>
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handlePickImage}
              disabled={photoLoading}
              style={styles.changePhotoButton}
            >
              <Text style={styles.changePhotoText}>
                {photoLoading ? 'Uploading...' : 'Change Photo'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.disabledInput}>
                <Text style={styles.disabledText}>{user?.email}</Text>
                <Ionicons name="lock-closed" size={16} color="#999" />
              </View>
              <Text style={styles.helperText}>Email cannot be changed</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your phone number"
                placeholderTextColor="#999"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(24, insets.bottom + 80) }]}>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
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
  cancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#D74826',
    fontWeight: '600',
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D74826',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  changePhotoButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changePhotoText: {
    fontSize: 15,
    color: '#D74826',
    fontWeight: '600',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  disabledInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  disabledText: {
    fontSize: 16,
    color: '#999',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  saveButton: {
    backgroundColor: '#D74826',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
