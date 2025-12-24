import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import BetaNoticeModal from '../components/BetaNoticeModal';

// Subtle service icons graphic component
const ServiceGraphic = () => (
  <View style={graphicStyles.container}>
    <View style={graphicStyles.iconRow}>
      <View style={[graphicStyles.iconCircle, graphicStyles.iconLeft]}>
        <Ionicons name="construct-outline" size={18} color="#E5393550" />
      </View>
      <View style={[graphicStyles.iconCircle, graphicStyles.iconCenter]}>
        <Ionicons name="home-outline" size={20} color="#E5393570" />
      </View>
      <View style={[graphicStyles.iconCircle, graphicStyles.iconRight]}>
        <Ionicons name="build-outline" size={18} color="#E5393550" />
      </View>
    </View>
    {/* Subtle connecting line */}
    <View style={graphicStyles.connectingLine} />
  </View>
);

const graphicStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 16,
    height: 60,
    justifyContent: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5393520',
  },
  iconLeft: {
    marginRight: -8,
    zIndex: 1,
  },
  iconCenter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    zIndex: 2,
    backgroundColor: '#FFEBEE',
    borderColor: '#E5393530',
  },
  iconRight: {
    marginLeft: -8,
    zIndex: 1,
  },
  connectingLine: {
    position: 'absolute',
    width: 100,
    height: 2,
    backgroundColor: '#E5393515',
    borderRadius: 1,
    top: '50%',
    zIndex: 0,
  },
});

export default function WelcomeScreen() {
  const router = useRouter();
  const { user, loading, shouldShowBetaNotice, markBetaNoticeSeen } = useAuth();

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
      <LinearGradient
        colors={['#EAF4FF', '#FFFFFF']}
        style={styles.container}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <Text style={styles.loadingText}>Loading...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#EAF4FF', '#FFFFFF']}
      style={styles.container}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <BetaNoticeModal 
        visible={shouldShowBetaNotice} 
        onClose={handleBetaNoticeContinue}
      />
      
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          {/* Subtle radial glow effect */}
          <View style={styles.logoGlow} />
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/images/fixr-logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Subtle service graphic */}
        <ServiceGraphic />
        
        {/* Main tagline */}
        <Text style={styles.tagline}>Where Trinis Get Things Done</Text>
        
        <Text style={styles.subtitle}>
          Connect with trusted service providers{"\n"}or offer your services to customers
        </Text>

        <View style={styles.features}>
          <View style={styles.feature}>
            <Ionicons name="flash" size={24} color="#E53935" />
            <Text style={styles.featureText}>Quick & Easy</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="shield-checkmark" size={24} color="#E53935" />
            <Text style={styles.featureText}>Verified Providers</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="people" size={24} color="#E53935" />
            <Text style={styles.featureText}>Local Services</Text>
          </View>
        </View>
      </View>

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -40,
  },
  logoWrapper: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#EAF4FF',
    opacity: 0.6,
  },
  logoContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#000000',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 70,
    height: 70,
  },
  tagline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  feature: {
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  buttonContainer: {
    paddingBottom: 48,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#E53935',
    paddingVertical: 16,
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
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#E53935',
    fontSize: 16,
    fontWeight: '500',
  },
});
