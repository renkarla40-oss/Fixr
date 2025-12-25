import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import BetaNoticeModal from '../components/BetaNoticeModal';

// Uploaded electrician background image
const HERO_IMAGE_URL = 'https://customer-assets.emergentagent.com/job_9839009c-27a4-4199-a2fc-d4475a74b912/artifacts/v3tftjv7_Electrician.png';

export default function WelcomeScreen() {
  const router = useRouter();
  const { user, loading, shouldShowBetaNotice, markBetaNoticeSeen } = useAuth();

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
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
          style={styles.overlay}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          {/* Logo at top */}
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
                <TouchableOpacity style={styles.socialIconButton} activeOpacity={0.7}>
                  <Ionicons name="logo-apple" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialIconButton} activeOpacity={0.7}>
                  <Ionicons name="logo-google" size={24} color="#FFFFFF" />
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
    backgroundColor: '#1A1A1A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#FFFFFF',
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
    paddingTop: 60,
  },
  logoContainer: {
    width: 72,
    height: 72,
    backgroundColor: '#000000',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 50,
    height: 50,
  },
  contentSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 24,
  },
  tagline: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 24,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  socialSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  socialText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 16,
  },
  socialIcons: {
    flexDirection: 'row',
    gap: 16,
  },
  socialIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  signInText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
  signInLink: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
