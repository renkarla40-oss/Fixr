import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageBackground, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import BetaNoticeModal from '../components/BetaNoticeModal';

WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Uploaded electrician background image
const HERO_IMAGE_URL = 'https://customer-assets.emergentagent.com/job_9839009c-27a4-4199-a2fc-d4475a74b912/artifacts/v3tftjv7_Electrician.png';

// ============================================================
// GOOGLE OAUTH CONFIGURATION
// ============================================================
// To enable Google Sign-In, you need to:
// 1. Go to https://console.cloud.google.com/
// 2. Create a new project or select existing one
// 3. Enable "Google+ API" or "Google Identity"
// 4. Go to "Credentials" → "Create Credentials" → "OAuth Client ID"
// 5. For Expo Go testing, create a "Web application" type client
// 6. Add this redirect URI: https://auth.expo.io/@your-expo-username/fixr
// 7. Copy the Client ID and paste it below
//
// For production builds, you'll also need iOS and Android client IDs
// ============================================================

const GOOGLE_CLIENT_ID = ''; // <-- PASTE YOUR GOOGLE WEB CLIENT ID HERE

// Expo AuthSession redirect URI for Google
const EXPO_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'fixr',
  useProxy: true, // This uses Expo's proxy for Expo Go
});

// Google OAuth discovery document
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Official Google "G" logo component with brand colors
const GoogleIcon = ({ size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Svg>
);

export default function WelcomeScreen() {
  const router = useRouter();
  const { user, loading, shouldShowBetaNotice, markBetaNoticeSeen, loginWithToken } = useAuth();
  const [socialLoading, setSocialLoading] = useState<'apple' | 'google' | null>(null);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  // Check if Apple Auth is available on this device
  useEffect(() => {
    const checkAppleAuth = async () => {
      if (Platform.OS === 'ios') {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        setAppleAuthAvailable(isAvailable);
      }
    };
    checkAppleAuth();
  }, []);

  // Google OAuth request
  const [googleRequest, googleResponse, promptGoogleAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: EXPO_REDIRECT_URI,
    },
    discovery
  );

  useEffect(() => {
    if (!loading && user) {
      if (!user.isBetaUser) {
        router.replace('/beta-gate');
        return;
      }
      if (!shouldShowBetaNotice) {
        navigateToHome();
      }
    }
  }, [user, loading, shouldShowBetaNotice]);

  // Handle Google OAuth response
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      handleGoogleSuccess(googleResponse.authentication?.accessToken);
    } else if (googleResponse?.type === 'error') {
      setSocialLoading(null);
      console.error('Google OAuth Error:', googleResponse.error);
      Alert.alert('Google Sign In Failed', 'Unable to sign in with Google. Please try again.');
    } else if (googleResponse?.type === 'dismiss') {
      setSocialLoading(null);
    }
  }, [googleResponse]);

  const navigateToHome = () => {
    if (!user) return;
    if (user.currentRole === 'customer') {
      router.replace('/(customer)/home');
    } else if (user.currentRole === 'provider' && user.isProviderEnabled) {
      router.replace('/(provider)/dashboard');
    } else if (user.currentRole === 'provider' && !user.isProviderEnabled) {
      router.replace('/provider-setup');
    }
  };

  const handleBetaNoticeContinue = async () => {
    await markBetaNoticeSeen();
    navigateToHome();
  };

  const handleContinueWithEmail = () => {
    router.push('/role-selection');
  };

  const handleContinueWithPhone = () => {
    router.push('/role-selection');
  };

  const handleSignIn = () => {
    router.push('/login');
  };

  // Apple Sign In Handler
  const handleAppleSignIn = async () => {
    // Check platform
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'Apple Sign In',
        'Apple Sign In is only available on iOS devices.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check availability
    if (!appleAuthAvailable) {
      Alert.alert(
        'Apple Sign In Unavailable',
        'Apple Sign In is not available on this device. Please use Email or Google sign in.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setSocialLoading('apple');
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Get user info from Apple
      const appleId = credential.user;
      const email = credential.email;
      const fullName = credential.fullName;
      const name = fullName ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() : null;

      // Send to backend
      const response = await axios.post(`${BACKEND_URL}/api/auth/social`, {
        provider: 'apple',
        providerId: appleId,
        email: email,
        name: name || 'Apple User',
      });

      // Login with received token
      if (response.data.token) {
        await loginWithToken(response.data.token, response.data.user);
        router.replace('/role-selection');
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled - do nothing
      } else {
        console.error('Apple Sign In Error:', error);
        Alert.alert('Apple Sign In Failed', error.message || 'Unable to sign in with Apple. Please try again.');
      }
    } finally {
      setSocialLoading(null);
    }
  };

  // Google Sign In - Fetch user info after OAuth
  const handleGoogleSuccess = async (accessToken: string | undefined) => {
    if (!accessToken) {
      setSocialLoading(null);
      Alert.alert('Google Sign In Failed', 'No access token received.');
      return;
    }

    try {
      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch user info from Google');
      }
      
      const userInfo = await userInfoResponse.json();

      // Send to backend
      const response = await axios.post(`${BACKEND_URL}/api/auth/social`, {
        provider: 'google',
        providerId: userInfo.id,
        email: userInfo.email,
        name: userInfo.name || 'Google User',
      });

      // Login with received token
      if (response.data.token) {
        await loginWithToken(response.data.token, response.data.user);
        router.replace('/role-selection');
      }
    } catch (error: any) {
      console.error('Google Sign In Error:', error);
      Alert.alert('Google Sign In Failed', error.message || 'Unable to complete Google sign in. Please try again.');
    } finally {
      setSocialLoading(null);
    }
  };

  // Handle Google button press
  const handleGoogleSignIn = async () => {
    // Check if Google Client ID is configured
    if (!GOOGLE_CLIENT_ID) {
      Alert.alert(
        'Configuration Required',
        'Google Sign-In requires a Google Client ID.\n\n' +
        'To set up:\n' +
        '1. Go to console.cloud.google.com\n' +
        '2. Create OAuth credentials\n' +
        '3. Add redirect URI:\n' +
        `   ${EXPO_REDIRECT_URI}\n\n` +
        '4. Add Client ID to welcome.tsx',
        [{ text: 'OK' }]
      );
      return;
    }

    setSocialLoading('google');
    try {
      await promptGoogleAsync();
    } catch (error) {
      console.error('Google prompt error:', error);
      setSocialLoading(null);
      Alert.alert('Google Sign In Failed', 'Unable to start Google sign in.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BetaNoticeModal 
        visible={shouldShowBetaNotice} 
        onClose={handleBetaNoticeContinue}
      />
      
      <ImageBackground
        source={{ uri: HERO_IMAGE_URL }}
        style={styles.heroBackground}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0.92)']}
          style={styles.overlay}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          {/* Logo at top - enlarged and anchored */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../assets/images/fixr-logo.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Content Section */}
          <View style={styles.contentSection}>
            <Text style={styles.tagline}>Where Trinis{'\n'}Get Things Done</Text>
            <Text style={styles.subtitle}>
              Book trusted Fixrs faster, track your jobs, and manage everything in one place.
            </Text>
          </View>

          {/* Auth Buttons */}
          <View style={styles.authSection}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleContinueWithEmail}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Continue with Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleContinueWithPhone}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Continue with Phone Number</Text>
            </TouchableOpacity>

            {/* Social Sign Up */}
            <View style={styles.socialSection}>
              <Text style={styles.socialText}>Or sign up with</Text>
              <View style={styles.socialIcons}>
                {/* Apple Sign In - clickable on all platforms */}
                <TouchableOpacity 
                  style={styles.socialIconButton} 
                  activeOpacity={0.7}
                  onPress={handleAppleSignIn}
                  disabled={socialLoading !== null}
                >
                  {socialLoading === 'apple' ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Ionicons name="logo-apple" size={26} color="#000000" />
                  )}
                </TouchableOpacity>
                
                {/* Google Sign In */}
                <TouchableOpacity 
                  style={styles.socialIconButton} 
                  activeOpacity={0.7}
                  onPress={handleGoogleSignIn}
                  disabled={socialLoading !== null}
                >
                  {socialLoading === 'google' ? (
                    <ActivityIndicator size="small" color="#4285F4" />
                  ) : (
                    <GoogleIcon size={24} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Link */}
            <TouchableOpacity onPress={handleSignIn} activeOpacity={0.7}>
              <Text style={styles.signInText}>
                Already have an account? <Text style={styles.signInLink}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#1A1A1A',
  },
  heroBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 56,
  },
  logoContainer: {
    width: 88,
    height: 88,
    backgroundColor: '#000000',
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 62,
    height: 62,
  },
  contentSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 24,
  },
  tagline: {
    fontSize: 34,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 12,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.7)',
    lineHeight: 24,
  },
  authSection: {
    paddingBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#E53935',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    marginBottom: 24,
  },
  secondaryButtonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '500',
  },
  socialSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  socialText: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: 14,
    marginBottom: 16,
  },
  socialIcons: {
    flexDirection: 'row',
    gap: 16,
  },
  socialIconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  signInText: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
  signInLink: {
    color: '#000000',
    fontWeight: '600',
  },
});
