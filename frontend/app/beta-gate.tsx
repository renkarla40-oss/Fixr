import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
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

export default function BetaGateScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleJoinWaitlist = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/waitlist`, {
        email: email.trim(),
        name: name.trim() || undefined,
      });

      setSubmitted(true);
    } catch (error: any) {
      if (__DEV__) {
        console.warn('Error joining waitlist:', error);
      }
      Alert.alert('Unable to Join', 'We couldn\'t add you to the waitlist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    // In DEV mode, go directly to login to allow switching accounts
    // In production, go to welcome
    if (__DEV__) {
      router.replace('/login');
    } else {
      router.replace('/welcome');
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>You're on the list!</Text>
            <Text style={styles.successText}>
              We'll notify you at {email} when beta access is available.
            </Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Text style={styles.backButtonText}>Back to Welcome</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="time" size={48} color="#E53935" />
          </View>
          
          <Text style={styles.title}>Beta Access Coming Soon</Text>
          
          <Text style={styles.subtitle}>
            Fixr is currently in private beta. We're working hard to bring you the best home services experience.
          </Text>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.featureText}>Connect with verified providers</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.featureText}>Book services with ease</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.featureText}>Secure & reliable platform</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.waitlistTitle}>Join the Waitlist</Text>
          <Text style={styles.waitlistSubtitle}>
            Be the first to know when we launch in your area.
          </Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Your name (optional)"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Your email address"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.joinButton, loading && styles.joinButtonDisabled]}
              onPress={handleJoinWaitlist}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="notifications" size={20} color="#FFFFFF" />
                  <Text style={styles.joinButtonText}>Notify Me</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>

          {/* DEV/TEST ONLY: Sign In button for QA testing */}
          {__DEV__ && (
            <View style={styles.devSection}>
              <View style={styles.devDivider}>
                <View style={styles.devDividerLine} />
                <Text style={styles.devDividerText}>DEV/TEST</Text>
                <View style={styles.devDividerLine} />
              </View>
              <TouchableOpacity
                style={styles.devSignInButton}
                onPress={() => router.push('/login')}
                activeOpacity={0.7}
              >
                <Ionicons name="log-in-outline" size={20} color="#E53935" />
                <Text style={styles.devSignInText}>Sign In (Test Account)</Text>
              </TouchableOpacity>
            </View>
          )}
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
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  featureList: {
    gap: 12,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 24,
  },
  waitlistTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  waitlistSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  form: {
    gap: 12,
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
  joinButton: {
    backgroundColor: '#E53935',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  logoutButton: {
    alignSelf: 'center',
    paddingVertical: 16,
    marginTop: 16,
  },
  logoutText: {
    fontSize: 14,
    color: '#999',
  },
  successIconContainer: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: '#E53935',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  // DEV/TEST only styles
  devSection: {
    marginTop: 32,
    paddingTop: 16,
  },
  devDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  devDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#FFD54F',
  },
  devDividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFA000',
  },
  devSignInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E53935',
    gap: 8,
  },
  devSignInText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E53935',
  },
});
