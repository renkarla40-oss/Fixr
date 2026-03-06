import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageBackground, ActivityIndicator } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import BetaNoticeModal from '../components/BetaNoticeModal';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Uploaded electrician background image
const HERO_IMAGE_URL = 'https://customer-assets.emergentagent.com/job_9839009c-27a4-4199-a2fc-d4475a74b912/artifacts/v3tftjv7_Electrician.png';

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

/**
 * Check if user is a TEST account that should bypass beta gate
 * TEST accounts: test.provider.*@example.com, *@test.com, or isTest flag
 */
const isTestAccount = (email: string | undefined): boolean => {
  if (!email) return false;
  const lowerEmail = email.toLowerCase();
  return (
    lowerEmail.startsWith('test.provider.') ||
    lowerEmail.endsWith('@test.com') ||
    lowerEmail.includes('test.') // Catches test.provider.*, test.customer.*, etc.
  );
};

export default function WelcomeScreen() {
  const router = useRouter();
  const segments = useSegments();
  const { user, loading, shouldShowBetaNotice, markBetaNoticeSeen } = useAuth();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // CRITICAL: Do NOT evaluate routing until auth loading is complete
    if (loading) {
      console.log('Welcome: Auth still loading, waiting...');
      return;
    }
    
    // Get current route segment
    const currentSegment = segments[0] || '';
    const isOnAuthenticatedRoute = currentSegment === '(customer)' || currentSegment === '(provider)';
    
    console.log('Welcome useEffect - loading:', loading, 'user:', user?.email, 'segment:', currentSegment, 'isOnAuthenticatedRoute:', isOnAuthenticatedRoute);
    
    // If already on an authenticated route (customer/provider tabs), don't redirect
    if (isOnAuthenticatedRoute) {
      console.log('Welcome: Already on authenticated route, skipping redirect');
      return;
    }
    
    // Only redirect ONCE - use ref to persist across re-renders
    if (hasRedirectedRef.current) {
      console.log('Welcome: Already redirected, skipping');
      return;
    }
    
    // Auto-route logged-in users to their home screen
    if (user) {
      // TEST accounts ALWAYS bypass beta gate (DEV/QA requirement)
      // Bypass if: isBetaUser flag, isTest flag, OR email matches test pattern
      const isTestByEmail = isTestAccount(user.email);
      const isTestByFlag = (user as any).isTest === true;
      const shouldBypassBetaGate = user.isBetaUser || isTestByFlag || isTestByEmail;
      
      console.log('Welcome: User authenticated -', user.email, 'isBetaUser:', user.isBetaUser, 'isTestFlag:', isTestByFlag, 'isTestByEmail:', isTestByEmail, 'bypass:', shouldBypassBetaGate);
      
      if (!shouldBypassBetaGate) {
        console.log('Welcome: Redirecting to beta-gate');
        hasRedirectedRef.current = true;
        router.replace('/beta-gate');
        return;
      }
      
      // Test accounts bypass beta notice entirely
      const shouldSkipBetaNotice = isTestByFlag || isTestByEmail;
      
      if (!shouldShowBetaNotice || shouldSkipBetaNotice) {
        console.log('Welcome: User bypasses beta gate, navigating to home');
        hasRedirectedRef.current = true;
        navigateToHome();
      }
    }
  }, [user, loading, shouldShowBetaNotice, segments]);

  const navigateToHome = () => {
    if (!user) return;
    console.log('Welcome navigateToHome - role:', user.currentRole, 'isProviderEnabled:', user.isProviderEnabled);
    
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

  // Loading state - simple spinner, NO logo (logo is on splash only)
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E53935" />
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
          {/* NO LOGO - Branding lives ONLY on splash screen */}
          {/* Top spacer to replace former logo section */}
          <View style={styles.topSpacer} />

          {/* Content Section */}
          <View style={styles.contentSection}>
            <Text style={styles.tagline}>Where Trinis{"\n"}Get Things Done</Text>
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

            {/* Social Sign Up - Disabled for beta */}
            <View style={styles.socialSection}>
              <Text style={styles.socialText}>Or sign up with</Text>
              <View style={styles.socialIcons}>
                {/* Apple icon - disabled */}
                <View style={styles.socialIconButton}>
                  <Ionicons name="logo-apple" size={26} color="#000000" />
                </View>
                
                {/* Google icon - disabled */}
                <View style={styles.socialIconButton}>
                  <GoogleIcon size={24} />
                </View>
              </View>
              <Text style={styles.comingSoonText}>Coming soon</Text>
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
  // Top spacer replaces former logo section
  topSpacer: {
    height: 80,
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
  comingSoonText: {
    color: 'rgba(0,0,0,0.4)',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
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
