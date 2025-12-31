import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
  Switch,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const BETA_EMAIL = 'fixr.beta@gmail.com';

interface ProviderProfile {
  isAcceptingJobs: boolean;
  availabilityNote: string | null;
  baseTown: string | null;
  travelDistanceKm: number;
  travelAnywhere: boolean;
  phoneVerified?: boolean;
  profilePhotoUrl?: string | null;
  governmentIdFrontUrl?: string | null;
  governmentIdBackUrl?: string | null;
  services?: string[];
}

export default function ProviderProfileScreen() {
  const { user, token, logout, switchRole } = useAuth();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingAvailability, setSavingAvailability] = useState(false);
  
  // Availability state
  const [isAcceptingJobs, setIsAcceptingJobs] = useState(true);
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [tempNote, setTempNote] = useState('');
  
  // Provider profile info
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);

  useEffect(() => {
    fetchProviderProfile();
  }, []);

  const fetchProviderProfile = async () => {
    try {
      setLoadingProfile(true);
      const response = await axios.get(`${BACKEND_URL}/api/providers/me/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = response.data;
      setProviderProfile(profile);
      setIsAcceptingJobs(profile.isAcceptingJobs ?? true);
      setAvailabilityNote(profile.availabilityNote || '');
    } catch (error) {
      console.warn('Could not load provider profile:', error);
      // Set defaults if profile not found
      setIsAcceptingJobs(true);
      setAvailabilityNote('');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleToggleAcceptingJobs = async (value: boolean) => {
    setIsAcceptingJobs(value);
    await saveAvailability(value, availabilityNote);
  };

  const saveAvailability = async (accepting: boolean, note: string) => {
    try {
      setSavingAvailability(true);
      await axios.patch(
        `${BACKEND_URL}/api/providers/me/availability`,
        {
          isAcceptingJobs: accepting,
          availabilityNote: note || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error: any) {
      if (__DEV__) {
        console.warn('Error saving availability:', error);
      }
      Alert.alert('Unable to Save', 'We couldn\'t update your availability. Please try again.');
      // Revert on error
      setIsAcceptingJobs(!accepting);
    } finally {
      setSavingAvailability(false);
    }
  };

  const handleSaveNote = async () => {
    if (tempNote.length > 60) {
      Alert.alert('Too Long', 'Availability note must be 60 characters or less.');
      return;
    }
    setAvailabilityNote(tempNote);
    setShowNoteModal(false);
    await saveAvailability(isAcceptingJobs, tempNote);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/welcome');
        },
      },
    ]);
  };

  const handleContactBeta = () => {
    Linking.openURL(`mailto:${BETA_EMAIL}?subject=Fixr Beta Feedback (Provider)`);
  };

  const handleSwitchToCustomer = async () => {
    setSwitching(true);
    try {
      await switchRole('customer');
      router.replace('/(customer)/home');
    } catch (error: any) {
      Alert.alert('Unable to Switch', 'We couldn\'t switch to customer mode right now. Please try again.');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              {providerProfile?.profilePhotoUrl ? (
                <Image
                  source={{ 
                    uri: providerProfile.profilePhotoUrl.startsWith('/') 
                      ? `${BACKEND_URL}${providerProfile.profilePhotoUrl}` 
                      : providerProfile.profilePhotoUrl 
                  }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons name="person" size={48} color="#666" />
              )}
            </View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.phone}>{user?.phone}</Text>
            <View style={styles.badgesRow}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>Provider</Text>
              </View>
              {providerProfile?.phoneVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                  <Text style={styles.verifiedText}>Phone verified</Text>
                </View>
              )}
              {providerProfile?.governmentIdFrontUrl && providerProfile?.governmentIdBackUrl && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={14} color="#4CAF50" />
                  <Text style={styles.verifiedText}>ID uploaded</Text>
                </View>
              )}
            </View>
          </View>

          {/* Availability Section - Phase 3A */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Availability</Text>
            
            <View style={styles.availabilityCard}>
              <View style={styles.availabilityToggleRow}>
                <View style={styles.availabilityInfo}>
                  <View style={[
                    styles.statusDot,
                    isAcceptingJobs ? styles.statusDotActive : styles.statusDotInactive
                  ]} />
                  <View>
                    <Text style={styles.availabilityLabel}>Accepting new jobs</Text>
                    <Text style={styles.availabilityHint}>
                      {isAcceptingJobs 
                        ? 'You appear in customer searches'
                        : 'You are hidden from searches'}
                    </Text>
                  </View>
                </View>
                {loadingProfile || savingAvailability ? (
                  <ActivityIndicator size="small" color="#E53935" />
                ) : (
                  <Switch
                    value={isAcceptingJobs}
                    onValueChange={handleToggleAcceptingJobs}
                    trackColor={{ false: '#E0E0E0', true: '#FFCDD2' }}
                    thumbColor={isAcceptingJobs ? '#E53935' : '#f4f3f4'}
                  />
                )}
              </View>
              
              <TouchableOpacity
                style={styles.noteButton}
                onPress={() => {
                  setTempNote(availabilityNote);
                  setShowNoteModal(true);
                }}
              >
                <Ionicons name="time-outline" size={20} color="#666" />
                <View style={styles.noteContent}>
                  <Text style={styles.noteLabel}>Availability note</Text>
                  <Text style={styles.noteValue} numberOfLines={1}>
                    {availabilityNote || 'Add a note (e.g., "Weekends only")'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/edit-profile')}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="person-outline" size={24} color="#666" />
                <Text style={styles.menuItemText}>Edit Profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleSwitchToCustomer}
              disabled={switching}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="swap-horizontal-outline" size={24} color="#E53935" />
                <Text style={[styles.menuItemText, styles.switchText]}>
                  Switch to Customer
                </Text>
              </View>
              {switching ? (
                <ActivityIndicator size="small" color="#E53935" />
              ) : (
                <Ionicons name="chevron-forward" size={24} color="#999" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Help & Support</Text>
            
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={handleContactBeta}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="mail-outline" size={24} color="#E53935" />
                <Text style={[styles.menuItemText, styles.betaText]}>Contact Fixr (Beta)</Text>
              </View>
              <Ionicons name="open-outline" size={20} color="#E53935" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/support')}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="headset-outline" size={24} color="#666" />
                <Text style={styles.menuItemText}>Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/feedback')}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="chatbubble-outline" size={24} color="#666" />
                <Text style={styles.menuItemText}>Send Feedback</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Legal</Text>
            
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/terms')}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="document-text-outline" size={24} color="#666" />
                <Text style={styles.menuItemText}>Terms of Service</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/privacy')}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="shield-outline" size={24} color="#666" />
                <Text style={styles.menuItemText}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={24} color="#E53935" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.versionSection}>
            <Text style={styles.versionText}>Fixr v1.0.0-beta</Text>
          </View>
        </ScrollView>
      </View>

      {/* Availability Note Modal */}
      <Modal
        visible={showNoteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNoteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Availability Note</Text>
              <TouchableOpacity onPress={() => setShowNoteModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDescription}>
              Add a short note about your availability. This helps customers know the best time to reach you.
            </Text>
            
            <TextInput
              style={styles.noteInput}
              placeholder="e.g., Weekends only, After 5pm, Available Mon-Fri"
              value={tempNote}
              onChangeText={setTempNote}
              maxLength={60}
              placeholderTextColor="#999"
              autoFocus
            />
            
            <Text style={styles.charCount}>{tempNote.length}/60 characters</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowNoteModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveNote}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  phone: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  roleText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  verifiedText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  // Availability styles (Phase 3A)
  availabilityCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  availabilityToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  availabilityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusDotActive: {
    backgroundColor: '#4CAF50',
  },
  statusDotInactive: {
    backgroundColor: '#9E9E9E',
  },
  availabilityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  availabilityHint: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  noteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  noteContent: {
    flex: 1,
  },
  noteLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  noteValue: {
    fontSize: 15,
    color: '#1A1A1A',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuItemText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  switchText: {
    color: '#E53935',
    fontWeight: '600',
  },
  betaText: {
    color: '#E53935',
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E53935',
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: 40,
  },
  versionText: {
    fontSize: 14,
    color: '#999',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  noteInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#E53935',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});