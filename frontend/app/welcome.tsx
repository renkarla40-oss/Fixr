import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageBackground, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import BetaNoticeModal from '../components/BetaNoticeModal';

const { width, height } = Dimensions.get('window');

// Hero background image URL
const HERO_IMAGE_URL = 'https://images.pexels.com/photos/16552856/pexels-photo-16552856.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2';

export default function WelcomeScreen() {
  const router = useRouter();
  const { user, loading, shouldShowBetaNotice, markBetaNoticeSeen } = useAuth();
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      // Check if user has beta access
      if (!user.isBetaUser) {
        router.replace('/beta-gate');
        return;
      }
      
      // Navigate to appropriate screen if user is logged in and has seen beta notice
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
      
      {/* Hero Background Image */}
      <ImageBackground
        source={{ uri: HERO_IMAGE_URL }}
        style={styles.heroBackground}
        resizeMode="cover"
        onLoad={() => setImageLoaded(true)}
      >
        {/* Dark gradient overlay for text readability */}
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
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
            {/* Main tagline */}
            <Text style={styles.tagline}>Where Trinis{'\n'}Get Things Done</Text>
            
            <Text style={styles.subtitle}>
              Connect with trusted service providers or offer your skills to customers in your area
            </Text>
          </View>

          {/* CTA Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/role-selection')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/login')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>I already have an account</Text>
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
    textAlign: 'center',
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
    width: 80,
    height: 80,
    backgroundColor: '#000000',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logo: {
    width: 55,
    height: 55,
  },
  contentSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 32,
  },
  tagline: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 24,
  },
  buttonContainer: {
    paddingBottom: 48,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#E53935',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});
