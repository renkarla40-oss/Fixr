import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login, user, loading: authLoading, token } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasAttemptedLogin, setHasAttemptedLogin] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    // Form validation with user-friendly messages
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address to sign in.');
      return;
    }
    
    if (!validateEmail(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address (e.g., name@example.com).');
      return;
    }
    
    if (!password) {
      Alert.alert('Password Required', 'Please enter your password to sign in.');
      return;
    }

    setLoading(true);
    setHasAttemptedLogin(true); // Mark that user is logging in through this form
    try {
      // Login returns the user data directly - use it for immediate navigation
      const userData = await login(email.trim(), password);
      console.log('Login successful, navigating with user data:', userData.email);
      
      // Navigate immediately using the returned user data (don't wait for state)
      navigateBasedOnUser(userData);
    } catch (error: any) {
      // User-friendly error messages
      const errorMessage = error.message?.toLowerCase() || '';
      if (errorMessage.includes('invalid') || errorMessage.includes('incorrect') || errorMessage.includes('not found')) {
        Alert.alert('Sign In Failed', 'The email or password you entered is incorrect. Please try again.');
      } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        Alert.alert('Connection Error', 'Unable to connect to the server. Please check your internet connection and try again.');
      } else {
        Alert.alert('Sign In Failed', 'Something went wrong. Please try again later.');
      }
      setLoading(false);
      setHasAttemptedLogin(false); // Reset on failure
    }
  };

  // Navigation function - can accept user from state or from parameter
  const navigateBasedOnUser = (userData: typeof user) => {
    if (!userData) return;
    
    console.log('Navigating user:', userData.email, 'role:', userData.currentRole, 'isBetaUser:', userData.isBetaUser);
    
    // DEV/TEST ONLY: Allow TEST users to bypass beta gate
    // TEST users are identified by email starting with "test.provider." or isTest flag
    const isTestUser = __DEV__ && (
      userData.email?.startsWith('test.provider.') ||
      userData.email?.includes('@example.com') ||
      (userData as any).isTest === true
    );
    
    // Check if user has beta access (or is a TEST user in DEV mode)
    if (!userData.isBetaUser && !isTestUser) {
      console.log('Redirecting to beta-gate');
      router.replace('/beta-gate');
      return;
    }
    
    if (isTestUser) {
      console.log('DEV/TEST: Bypassing beta gate for TEST user');
    }
    
    // Navigate based on role
    if (userData.currentRole === 'provider' && userData.isProviderEnabled) {
      console.log('Redirecting to provider dashboard');
      router.replace('/(provider)/dashboard');
    } else if (userData.currentRole === 'provider' && !userData.isProviderEnabled) {
      console.log('Redirecting to provider setup');
      router.replace('/provider-setup');
    } else {
      console.log('Redirecting to customer home');
      router.replace('/(customer)/home');
    }
  };

  // Handle the case where user successfully logged in via this form
  // ONLY redirect if they logged in through this form (hasAttemptedLogin is true)
  // This prevents the redirect loop when users navigate to login after logout
  useEffect(() => {
    console.log('Login useEffect - user:', user?.email, 'authLoading:', authLoading, 'hasAttemptedLogin:', hasAttemptedLogin);
    
    // Only auto-redirect if:
    // 1. Auth is done loading
    // 2. We have a user
    // 3. The user logged in through THIS form (not navigating back after logout)
    if (!authLoading && user && hasAttemptedLogin) {
      console.log('User logged in via form, redirecting...');
      navigateBasedOnUser(user);
    }
  }, [user, authLoading, hasAttemptedLogin]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              loading && styles.loginButtonDisabled,
              pressed && styles.loginButtonPressed,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </Pressable>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/role-selection')}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 100,  // Extra padding to prevent CTA from being blocked by nav bar
  },
  header: {
    marginBottom: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    minHeight: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  eyeIcon: {
    padding: 8,
  },
  loginButton: {
    backgroundColor: '#D74826',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  loginButtonPressed: {
    backgroundColor: '#D74826',
    opacity: 0.9,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
    color: '#666',
  },
  signupLink: {
    fontSize: 14,
    color: '#D74826',
    fontWeight: '600',
  },
});