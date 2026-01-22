import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated, Easing, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Metro-style logo sizing: 70% of screen width
const LOGO_WIDTH = SCREEN_WIDTH * 0.7;
const LOGO_HEIGHT = LOGO_WIDTH * 0.5; // Maintain aspect ratio

/**
 * Splash Screen - Metro by T-Mobile Style
 * 
 * BRAND-FIRST splash with bold, dominant Fixr logo.
 * Animation: Scale down from 110% to 100% with ease-out (600-800ms).
 * No fade, no bounce, no gimmicks.
 */
export default function SplashScreen() {
  const router = useRouter();
  const { loading } = useAuth();
  
  // Metro-style animation: starts slightly larger (1.1x), scales down to 1.0x
  const scaleAnim = useRef(new Animated.Value(1.1)).current;
  const animationComplete = useRef(false);
  const hasNavigated = useRef(false);

  // Run Metro-style scale-down animation
  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: 1.0,
      duration: 700, // 600-800ms range
      easing: Easing.out(Easing.cubic), // ease-out
      useNativeDriver: true,
    }).start(() => {
      // Animation complete callback
      animationComplete.current = true;
    });

    // Fallback: mark animation complete after duration + buffer
    const timer = setTimeout(() => {
      animationComplete.current = true;
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // Navigate when BOTH animation is complete AND auth loading is done
  useEffect(() => {
    const checkAndNavigate = () => {
      if (!loading && animationComplete.current && !hasNavigated.current) {
        hasNavigated.current = true;
        // Transition directly to welcome screen
        router.replace('/welcome');
      }
    };

    // Check immediately
    checkAndNavigate();

    // Also check periodically in case loading finished before animation
    const interval = setInterval(checkAndNavigate, 50);

    return () => clearInterval(interval);
  }, [loading]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('../assets/images/fixr-logo.png')}
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
    backgroundColor: '#000000', // Solid black background
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
});
