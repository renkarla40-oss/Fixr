import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BETA_EMAIL = 'fixr.beta@gmail.com';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, switchRole } = useAuth();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  // Get profile photo URL
  const getPhotoUrl = () => {
    const photoUrl = (user as any)?.profilePhotoUrl;
    if (!photoUrl) return null;
    if (photoUrl.startsWith('http')) return photoUrl;
    return `${BACKEND_URL}${photoUrl}`;
  };

  const profilePhotoUrl = getPhotoUrl();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          // In DEV mode, go directly to login to allow switching accounts
          // In production, go to welcome
          if (__DEV__) {
            router.replace('/login');
          } else {
            router.replace('/welcome');
          }
        },
      },
    ]);
  };

  const handleContactBeta = () => {
    Linking.openURL(`mailto:${BETA_EMAIL}?subject=Fixr Beta Feedback`);
  };

  const handleSwitchToProvider = async () => {
    if (!user) return;

    setSwitching(true);
    try {
      if (user.isProviderEnabled) {
        // Provider setup already complete, just switch role
        await switchRole('provider');
        router.replace('/(provider)/dashboard');
      } else {
        // Need to complete provider setup first
        router.push('/provider-setup');
      }
    } catch (error: any) {
      Alert.alert('Unable to Switch', 'We couldn\'t switch to provider mode right now. Please try again.');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
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
              {profilePhotoUrl ? (
                <Image 
                  source={{ uri: profilePhotoUrl }} 
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons name="person" size={48} color="#666" />
              )}
            </View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.phone}>{user?.phone}</Text>
            <View style={styles.roleBadge}>
              <Ionicons name="person" size={14} color="#4CAF50" />
              <Text style={styles.roleText}>Customer</Text>
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
              onPress={handleSwitchToProvider}
              disabled={switching}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="swap-horizontal-outline" size={24} color="#C13E1F" />
                <Text style={[styles.menuItemText, styles.switchText]}>
                  Switch to Provider
                </Text>
              </View>
              {switching ? (
                <ActivityIndicator size="small" color="#C13E1F" />
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
                <Ionicons name="mail-outline" size={24} color="#C13E1F" />
                <Text style={[styles.menuItemText, styles.betaText]}>Contact Fixr (Beta)</Text>
              </View>
              <Ionicons name="open-outline" size={20} color="#C13E1F" />
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
              <Ionicons name="log-out-outline" size={24} color="#C13E1F" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.versionSection}>
            <Text style={styles.versionText}>Fixr v1.0.0-beta</Text>
          </View>
        </ScrollView>
      </View>
    </View>
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  roleText: {
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
    color: '#C13E1F',
    fontWeight: '600',
  },
  betaText: {
    color: '#C13E1F',
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
    color: '#C13E1F',
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
});
