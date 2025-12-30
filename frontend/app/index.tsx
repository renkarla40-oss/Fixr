import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * Splash Screen - Purely Visual
 * 
 * RULES:
 * - NO API calls
 * - NO push notification registration
 * - NO Axios requests
 * - NO white background or white circle
 * - Dark, bold, premium aesthetic
 */
export default function SplashScreen() {
  const router = useRouter();
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Main entrance animation - logo zooms forward toward viewer
    const entranceAnimation = Animated.parallel([
      // Scale from smaller (0.7) to prominent (1.15) - "coming at you" effect
      Animated.timing(scaleAnim, {
        toValue: 1.15,
        duration: 1600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Fade in smoothly
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    // Subtle breathing pulse during zoom - creates life/presence
    const breathingAnimation = Animated.sequence([
      Animated.timing(breatheAnim, {
        toValue: 1.03,
        duration: 550,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(breatheAnim, {
        toValue: 0.98,
        duration: 450,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(breatheAnim, {
        toValue: 1.01,
        duration: 400,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(breatheAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    // Run entrance and breathing in parallel
    Animated.parallel([
      entranceAnimation,
      breathingAnimation,
    ]).start();

    // Navigate after animation + hold (total ~2s)
    const timer = setTimeout(() => {
      router.replace('/welcome');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Combine scale animations
  const combinedScale = Animated.multiply(scaleAnim, breatheAnim);

  return (
    <View style={styles.container}>
      {/* Dark gradient overlay for depth */}
      <View style={styles.gradientOverlay} />
      
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            transform: [{ scale: combinedScale }],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Logo without any circle - direct and bold */}
        <Image 
          source={require('../assets/images/fixr-logo-actual.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A', // Dark charcoal - bold and premium
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Subtle radial effect - slightly lighter in center
    backgroundColor: 'transparent',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 110,
  },
});
