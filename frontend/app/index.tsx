import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

/**
 * Splash Screen - Waits for auth loading to complete
 * 
 * Shows splash animation while AuthContext validates stored session.
 * Routes to welcome screen which handles authenticated user routing.
 */
export default function SplashScreen() {
  const router = useRouter();
  const { loading } = useAuth();
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const animationComplete = useRef(false);
  const hasNavigated = useRef(false);

  // Run splash animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1.4,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // Mark animation as complete after 1600ms
    const timer = setTimeout(() => {
      animationComplete.current = true;
    }, 1600);

    return () => clearTimeout(timer);
  }, []);

  // Navigate only when BOTH animation is complete AND auth loading is done
  useEffect(() => {
    if (!loading && animationComplete.current && !hasNavigated.current) {
      hasNavigated.current = true;
      // Always route to welcome - it handles authenticated user redirection
      router.replace('/welcome');
    }
  }, [loading]);

  // Also check periodically in case loading finished before animation
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && animationComplete.current && !hasNavigated.current) {
        hasNavigated.current = true;
        // DEV/QA: Always go to login (no auto-login)
        // Production: Go to welcome (handles auth state)
        if (__DEV__) {
          router.replace('/login');
        } else {
          router.replace('/welcome');
        }
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [loading]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
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
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 260,
    height: 130,
  },
});
