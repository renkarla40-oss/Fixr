import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';

export default function SplashScreen() {
  const router = useRouter();
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Main entrance animation
    const entranceAnimation = Animated.parallel([
      // Scale from small (0.6) to large (1.25) - creates "coming at you" effect
      Animated.timing(scaleAnim, {
        toValue: 1.25,
        duration: 1800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Fade in quickly at the start
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    // Gentle breathing pulse during the zoom
    const breathingAnimation = Animated.sequence([
      Animated.timing(breatheAnim, {
        toValue: 1.04,
        duration: 600,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(breatheAnim, {
        toValue: 0.97,
        duration: 500,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(breatheAnim, {
        toValue: 1.02,
        duration: 450,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(breatheAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    // Run entrance and breathing in parallel
    Animated.parallel([
      entranceAnimation,
      breathingAnimation,
    ]).start();

    // Navigate after animation completes + hold time (200-400ms)
    const timer = setTimeout(() => {
      router.replace('/welcome');
    }, 2100); // ~1.8s animation + 300ms hold

    return () => clearTimeout(timer);
  }, []);

  // Combine scale animations: entrance zoom * breathing pulse
  const combinedScale = Animated.multiply(scaleAnim, breatheAnim);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            transform: [{ scale: combinedScale }],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* White-background Fixr logo - premium feel */}
        <Image 
          source={require('../assets/images/fixr-logo-white.png')} 
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 280,
    height: 280,
  },
});
