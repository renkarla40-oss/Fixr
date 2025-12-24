import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import BetaNoticeModal from '../components/BetaNoticeModal';

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
      <View style={styles.container}>
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
      
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/images/fixr-logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  logoContainer: {
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#000000',
    borderRadius: 16,
  },
  logo: {
    width: 180,
    height: 80,
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